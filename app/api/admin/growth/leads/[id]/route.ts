import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { getLead, updateLead, updateMessage, suppress } from "@/lib/growth/store";
import { getSupabaseClient } from "@/lib/supabase/client";

export const runtime = "nodejs";

const ACTIONS: Record<string, string> = { replied: "replied", demo_booked: "demo_booked", won: "won", lost: "lost", reopen: "enriched" };

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  const { id } = await ctx.params;
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  const lead = await getLead(id);
  if (!lead) return NextResponse.json({ success: false, error: "Unknown lead." }, { status: 404 });

  if (action === "suppress") {
    if (lead.email) await suppress(lead.email, "manual");
    await updateLead(id, { stage: "unsubscribed", next_action_at: null });
  } else if (action && ACTIONS[action]) {
    await updateLead(id, { stage: ACTIONS[action], next_action_at: null });
  } else {
    return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
  }
  // Any change that ends the sequence also cancels unsent drafts.
  if (action !== "reopen") {
    await getSupabaseClient().from("outreach_messages").update({ status: "skipped" }).eq("lead_id", id).in("status", ["draft", "approved"]);
  }
  void updateMessage;
  return NextResponse.json({ success: true });
}
