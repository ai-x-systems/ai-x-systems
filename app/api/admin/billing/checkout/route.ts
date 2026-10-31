import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { getStoredBusiness } from "@/lib/config/business-store";
import { PLAN_KEYS, type PlanKey } from "@/lib/billing/whop";
import { createWhopCheckout, whopConfigured } from "@/lib/billing/whop-checkout";

export const runtime = "nodejs";

/** Admin only: create a Whop payment link for one client and one plan. */
export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  if (!whopConfigured()) return NextResponse.json({ success: false, error: "WHOP_API_KEY is not set in Vercel yet." }, { status: 503 });

  const b = (await req.json().catch(() => ({}))) as { businessId?: string; plan?: string };
  const planKey = PLAN_KEYS.find((k) => k === b.plan) as PlanKey | undefined;
  if (!b.businessId || !planKey) return NextResponse.json({ success: false, error: "Choose a client and a plan." }, { status: 400 });

  const stored = await getStoredBusiness(b.businessId);
  if (!stored || stored.source !== "db") return NextResponse.json({ success: false, error: "That client was not found." }, { status: 404 });

  try {
    const { url } = await createWhopCheckout({ planKey, businessId: b.businessId });
    return NextResponse.json({ success: true, url });
  } catch (err) {
    console.error("[whop] checkout creation failed:", err);
    return NextResponse.json({ success: false, error: "Whop could not create the link. Check WHOP_API_KEY and its permissions." }, { status: 502 });
  }
}
