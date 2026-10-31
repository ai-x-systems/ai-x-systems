import { NextRequest, NextResponse } from "next/server";
import { unwrapWebhook } from "@whop/sdk/helpers";
import crypto from "crypto";
import { getSupabaseClient } from "@/lib/supabase/client";
import { setBusinessFlags } from "@/lib/config/business-store";
import { sendFounderAlert } from "@/lib/integrations/notify";
import { siteConfig } from "@/lib/site-config";
import { creditLedger } from "@/lib/billing/credits";
import { decideWhopAction, metadataBusinessId, paymentEmail, paymentId, whopPlanIds } from "@/lib/billing/whop";

export const runtime = "nodejs";

/**
 * Whop → Developer → Webhooks → Create webhook:
 *   URL: https://<your-domain>/api/billing/whop
 *   Events: payment.succeeded, payment.failed, refund.created, dispute.created
 * Env: WHOP_WEBHOOK_SECRET (the ws_... secret Whop shows for that webhook).
 *
 * The signature is verified before anything is read. The same event can be delivered more than
 * once, so each payment/event is recorded once in billing_events and a repeat is a no-op, which
 * means a retry can never credit minutes twice. A failure after logging removes the row and
 * returns 500, so Whop's retry is processed instead of skipped.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.WHOP_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const raw = await req.text();
  let evt: { type?: unknown; data?: unknown };
  try {
    evt = unwrapWebhook<{ type?: unknown; data?: unknown }>(raw, { headers: Object.fromEntries(req.headers), key: secret });
  } catch {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  const type = typeof evt.type === "string" ? evt.type : "unknown";
  const data = evt.data;
  const ids = whopPlanIds();
  const decision = decideWhopAction(type, data, ids);
  if (!decision.alert) return NextResponse.json({ ok: true, ignored: true });

  const pid = paymentId(data);
  const deliveryId = req.headers.get("webhook-id") ?? crypto.createHash("sha256").update(raw).digest("hex");
  const eventId = pid ? `whop:${type}:${pid}` : `whop:${deliveryId}`;
  const email = paymentEmail(data);
  const db = getSupabaseClient();

  const { error: dupErr } = await db.from("billing_events").insert({ event_id: eventId, type: `whop.${type}`, email: email ?? null, payload: { type, data } });
  if (dupErr) {
    if (dupErr.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
    console.error("[whop] failed to log event:", dupErr);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }

  try {
    // Match the client: the id our checkout link attached first, then the buyer's email.
    let businessId: string | null = null;
    const fromMeta = metadataBusinessId(data);
    if (fromMeta) {
      const { data: row } = await db.from("businesses").select("id").eq("id", fromMeta).maybeSingle();
      businessId = row?.id ?? null;
    }
    if (!businessId && email) {
      const { data: row } = await db.from("businesses").select("id").eq("client_email", email).maybeSingle();
      businessId = row?.id ?? null;
    }

    let credited = 0;
    if (businessId && decision.minutes > 0) {
      await creditLedger.recordTransaction(businessId, "manual_topup", decision.minutes, `Minute pack purchased (Whop ${pid ?? eventId.slice(-8)})`);
      credited = decision.minutes;
    }
    if (businessId && decision.status) await setBusinessFlags(businessId, { billing_status: decision.status });
    if (businessId) await db.from("billing_events").update({ business_id: businessId }).eq("event_id", eventId);

    const matched = businessId ? `matched client "${businessId}"` : "matched NO client: check the email, or set it by hand in /admin";
    await sendFounderAlert(`Billing: ${type}`, [
      `${decision.note} Buyer: ${email ?? "unknown"}, ${matched}.`,
      businessId && decision.status ? `Billing status is now "${decision.status}".` : "No billing status change was made.",
      credited > 0
        ? `Credited ${credited} voice minutes.`
        : decision.minutes > 0
          ? `NOT credited (no client matched). Add ${decision.minutes} minutes by hand in /admin${pid ? ` (Whop payment ${pid})` : ""}.`
          : "No voice minutes were credited.",
      `${siteConfig.brand.baseUrl}/admin`,
    ]);
  } catch (err) {
    console.error("[whop] processing failed:", err);
    await db.from("billing_events").delete().eq("event_id", eventId);
    return NextResponse.json({ error: "Processing error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
