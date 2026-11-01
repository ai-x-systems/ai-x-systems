import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { deleteClient } from "@/lib/admin/delete-client";

export const runtime = "nodejs";

/** Admin: permanently delete a client. The body must repeat the client's id, so it can't happen by accident. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ businessId: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  const { businessId } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as { confirm?: string; force?: boolean };
  if (b.confirm !== businessId) return NextResponse.json({ success: false, error: "Type the client id exactly to confirm." }, { status: 400 });
  const r = await deleteClient(businessId, { allowActiveBilling: b.force === true });
  if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: r.status });
  return NextResponse.json({ success: true });
}
