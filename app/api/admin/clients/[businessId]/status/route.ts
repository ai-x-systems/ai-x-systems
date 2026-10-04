import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { setBusinessFlags } from "@/lib/config/business-store";

export const runtime = "nodejs";

const BILLING = ["awaiting_payment", "active", "past_due", "cancelled", "refunded"];

export async function POST(req: NextRequest, ctx: { params: Promise<{ businessId: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  const { businessId } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as { active?: boolean; billingStatus?: string };
  const patch: { active?: boolean; billing_status?: string } = {};
  if (typeof b.active === "boolean") patch.active = b.active;
  if (b.billingStatus) {
    if (!BILLING.includes(b.billingStatus)) return NextResponse.json({ success: false, error: "Unknown billing status." }, { status: 400 });
    patch.billing_status = b.billingStatus;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ success: false, error: "Nothing to change." }, { status: 400 });
  const ok = await setBusinessFlags(businessId, patch);
  return ok ? NextResponse.json({ success: true }) : NextResponse.json({ success: false, error: "Only businesses created through onboarding can be paused here." }, { status: 404 });
}
