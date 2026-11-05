import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { applyClientSettings, SETTINGS_ACTIONS } from "@/lib/config/client-settings";

export const runtime = "nodejs";

/** Admin: change a client's assistant (name, tone, voice, greeting), details, hours, services, or pause them. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ businessId: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  const { businessId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!SETTINGS_ACTIONS.some((a) => a === body.action)) return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
  const r = await applyClientSettings(businessId, body);
  return r.ok ? NextResponse.json({ success: true }) : NextResponse.json({ success: false, error: r.error }, { status: r.status });
}
