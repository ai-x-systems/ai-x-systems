import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { runIntegrationsAction } from "@/lib/config/integrations-actions";

export const runtime = "nodejs";

/** Admin: the same integration controls the client has, for any client. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ businessId: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  const { businessId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const r = await runIntegrationsAction(businessId, body);
  return NextResponse.json(r.json, { status: r.status });
}
