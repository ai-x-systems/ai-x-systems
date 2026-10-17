import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { getBusiness } from "@/lib/config/business-store";
import { getBusinessOverride, saveChatOverride } from "@/lib/config/overrides";
import { sanitizeChat } from "@/lib/config/chat-settings";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ businessId: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  const { businessId } = await ctx.params;
  const business = await getBusiness(businessId);
  if (!business) return NextResponse.json({ success: false, error: "Unknown business." }, { status: 404 });
  const override = await getBusinessOverride(businessId);
  return NextResponse.json({ success: true, chat: { ...(business.chat ?? {}), ...(override?.chat ?? {}) } });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ businessId: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  const { businessId } = await ctx.params;
  if (!(await getBusiness(businessId))) return NextResponse.json({ success: false, error: "Unknown business." }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  const r = await saveChatOverride(businessId, sanitizeChat(body));
  return r.ok ? NextResponse.json({ success: true }) : NextResponse.json({ success: false, error: r.error }, { status: 500 });
}
