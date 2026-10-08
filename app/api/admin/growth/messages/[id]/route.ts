import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { updateMessage, updateLead, getSupabaseLeadIdForMessage, getMessageStep } from "@/lib/growth/store";

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  const { id } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as { action?: string; subject?: string; bodyText?: string };

  if (b.action === "approve") {
    const patch: Record<string, unknown> = { status: "approved" };
    if (b.subject?.trim()) patch.subject = b.subject.trim().slice(0, 200);
    if (b.bodyText?.trim()) patch.body_text = b.bodyText.trim().slice(0, 4000);
    await updateMessage(id, patch);
    const leadId = await getSupabaseLeadIdForMessage(id);
    if (leadId) await updateLead(leadId, { stage: "queued" });
  } else if (b.action === "sent_manually") {
    // You sent this one from your own mailbox. Record it and schedule the next follow-up.
    const leadId = await getSupabaseLeadIdForMessage(id);
    const step = await getMessageStep(id);
    if (!leadId || !step) return NextResponse.json({ success: false, error: "Unknown message." }, { status: 404 });
    const DAY = 86_400_000;
    const gap = step === 1 ? 3 * DAY : step === 2 ? 4 * DAY : 0;
    await updateMessage(id, { status: "sent", sent_at: new Date().toISOString(), error: null });
    await updateLead(leadId, {
      stage: "contacted", step, last_contacted_at: new Date().toISOString(),
      next_action_at: gap ? new Date(Date.now() + gap).toISOString() : null,
    });
  } else if (b.action === "skip") {
    await updateMessage(id, { status: "skipped" });
  } else {
    return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
