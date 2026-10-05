import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { updateMessage, updateLead, getSupabaseLeadIdForMessage } from "@/lib/growth/store";

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
  } else if (b.action === "skip") {
    await updateMessage(id, { status: "skipped" });
  } else {
    return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
