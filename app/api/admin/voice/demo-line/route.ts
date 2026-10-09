import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { getStoredBusiness } from "@/lib/config/business-store";
import { pointDemoLine } from "@/lib/voice/store";
import { normalizeE164 } from "@/lib/voice/pure";
import { isDemoId } from "@/lib/onboarding/build-config";

export const runtime = "nodejs";

/** Points the single shared demo phone line at one preview business (or creates the line the first time). */
export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { businessId?: string; number?: string };
  if (!b.businessId || !isDemoId(b.businessId)) return NextResponse.json({ success: false, error: "Pick a preview business." }, { status: 400 });
  const stored = await getStoredBusiness(b.businessId);
  if (!stored || !stored.config.demo) return NextResponse.json({ success: false, error: "That preview no longer exists." }, { status: 404 });

  const number = b.number?.trim() ? normalizeE164(b.number) : undefined;
  if (b.number?.trim() && !number) return NextResponse.json({ success: false, error: "That phone number isn't valid." }, { status: 400 });

  const r = await pointDemoLine(b.businessId, number);
  return r.ok ? NextResponse.json({ success: true }) : NextResponse.json({ success: false, error: r.error }, { status: 409 });
}
