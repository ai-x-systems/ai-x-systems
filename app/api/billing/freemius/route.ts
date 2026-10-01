import { NextRequest, NextResponse } from "next/server";
import { verifyFreemiusSignature, extractBuyerEmail, statusForEvent, ALERT_EVENTS } from "@/lib/billing/freemius";
import { getSupabaseClient } from "@/lib/supabase/client";
import { setBusinessFlags } from "@/lib/config/business-store";
import { sendFounderAlert } from "@/lib/integrations/notify";
import { siteConfig } from "@/lib/site-config";
import crypto from "crypto";
import { creditLedger } from "@/lib/billing/credits";
import { minutesForPayment, parsePacks } from "@/lib/voice/pure";

export const runtime = "nodejs";

/**
 * Freemius → Developer Dashboard → Webhooks → Listeners → Add Webhook:
 *   URL: https://<your-domain>/api/billing/freemius   (events: payment.*, subscription.*)
 * Env: FREEMIUS_PRODUCT_SECRET_KEY (the product's secret key).
 *
 * On a payment: matches the buyer's email to a client created in
 * /admin/onboard and marks that client's billing "active". It never
 * auto-pauses anyone — cancellations/failed renewals/refunds only set the
 * status and email you, so a mis-parsed payload can't switch off a paying
 * client. You decide whether to pause from /admin.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.FREEMIUS_PRODUCT_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const raw = await req.text();
  if (!verifyFreemiusSignature(raw, req.headers.get("x-signature"), secret)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  let evt: Record<string, unknown>;
  try { evt = JSON.parse(raw); } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }

  const type = typeof evt.type === "string" ? evt.type : "unknown";
  const eventId = String(evt.id ?? crypto.createHash("sha256").update(raw).digest("hex"));
  const email = extractBuyerEmail(evt);
  const db = getSupabaseClient();

  // Idempotency: Freemius may retry. A duplicate event_id is a no-op.
  const { error: dupErr } = await db.from("billing_events").insert({ event_id: eventId, type, email: email ?? null, payload: evt });
  if (dupErr) {
    if (dupErr.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
    console.error("[freemius] failed to log event:", dupErr);
    return NextResponse.json({ error: "Storage error" }, { status: 500 }); // Freemius will retry
  }

  try {
    // Match the buyer to a DB-onboarded client by email.
    let businessId: string | null = null;
    if (email) {
      const { data } = await db.from("businesses").select("id").eq("client_email", email).maybeSingle();
      businessId = data?.id ?? null;
    }

    // Prepaid voice minutes: a payment for a configured minute pack credits that many minutes.
  // FREEMIUS_MINUTE_PACKS='{"<plan or pricing id>": 100}'. Only payment.created credits, and the
  // event id is already de-duplicated above, so a retry can never credit twice.
  let creditedMinutes = 0;
  if (businessId && type === "payment.created") {
    creditedMinutes = minutesForPayment(evt, parsePacks(process.env.FREEMIUS_MINUTE_PACKS));
    if (creditedMinutes > 0) await creditLedger.recordTransaction(businessId, "manual_topup", creditedMinutes, `Minute pack purchased (Freemius ${eventId.slice(0, 8)})`);
  }

  const status = statusForEvent(type);
    if (businessId && status) {
      await setBusinessFlags(businessId, { billing_status: status });
      await db.from("billing_events").update({ business_id: businessId }).eq("event_id", eventId);
    }

    if (ALERT_EVENTS.has(type)) {
      const matched = businessId ? `matched client "${businessId}"` : "matched NO client — check the email or set it manually in /admin";
      await sendFounderAlert(`Billing: ${type}`, [
        `${type} from ${email ?? "an unknown buyer"} — ${matched}.`,
        status && businessId ? `Billing status is now "${status}".` : "No status change was made.",
      creditedMinutes > 0 ? `Credited ${creditedMinutes} voice minutes.` : "No voice minutes were credited (not a configured minute pack, or no client matched) — top up by hand in /admin if this was a pack purchase.",
        `${siteConfig.brand.baseUrl}/admin`,
      ]);
    }

  } catch (err) {
    // Processing failed AFTER we logged the event id. Remove the row so
    // Freemius's retry is processed instead of being skipped as a duplicate.
    console.error("[freemius] processing failed:", err);
    await db.from("billing_events").delete().eq("event_id", eventId);
    return NextResponse.json({ error: "Processing error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
