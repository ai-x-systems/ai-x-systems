import { NextRequest, NextResponse } from "next/server";
import { verifySvix, firstEmailIn } from "@/lib/growth/pure";
import { markOutreachReplied, suppress, listLeads, updateLead } from "@/lib/growth/store";
import { sendFounderAlert } from "@/lib/integrations/notify";
import { getSupabaseClient } from "@/lib/supabase/client";

export const runtime = "nodejs";

/**
 * Resend webhook (Resend dashboard → Webhooks → this URL, events:
 * email.bounced, email.complained, email.received). Signature-verified.
 *  - bounce / complaint → address is suppressed forever, sequence stops
 *  - inbound reply       → sequence stops, lead becomes "replied", you're alerted
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const raw = await req.text();
  const ok = verifySvix(raw, {
    id: req.headers.get("svix-id"),
    timestamp: req.headers.get("svix-timestamp"),
    signature: req.headers.get("svix-signature"),
  }, secret);
  if (!ok) return NextResponse.json({ error: "Bad signature" }, { status: 401 });

  const evt = JSON.parse(raw) as { type?: string; data?: { to?: string[] | string; from?: string; subject?: string } };
  const type = evt.type ?? "";
  const toList = Array.isArray(evt.data?.to) ? evt.data!.to! : evt.data?.to ? [evt.data.to] : [];

  if (type === "email.bounced" || type === "email.complained") {
    for (const to of toList) {
      const email = firstEmailIn(to);
      if (!email) continue;
      await suppress(email, type === "email.bounced" ? "bounced" : "complained");
      const leads = await listLeads({ limit: 1000 });
      for (const l of leads.filter((x) => x.email?.toLowerCase() === email)) {
        await updateLead(l.id, { stage: type === "email.bounced" ? "bounced" : "unsubscribed", next_action_at: null });
        await getSupabaseClient().from("outreach_messages").update({ status: "skipped" }).eq("lead_id", l.id).in("status", ["draft", "approved"]);
      }
    }
  } else if (type === "email.received") {
    const from = firstEmailIn(evt.data?.from ?? "");
    if (from) {
      await markOutreachReplied(from, "replied");
      await sendFounderAlert(`Reply from a prospect: ${from}`, [`${from} replied to your outreach.`, `Subject: ${evt.data?.subject ?? "-"}`, "Open the Growth dashboard to follow up."]);
    }
  }
  return NextResponse.json({ ok: true });
}
