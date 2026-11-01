import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { getSupabaseClient } from "@/lib/supabase/client";

export const runtime = "nodejs";

/** Admin: cancel a setup link that hasn't been used yet. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  const { id } = await ctx.params;
  await getSupabaseClient().from("client_intakes").delete().eq("id", id).eq("status", "pending");
  return NextResponse.json({ success: true });
}
