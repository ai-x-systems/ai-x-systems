import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { cancelSubscription, resumeSubscription } from "@/lib/billing/subscription";

export const runtime = "nodejs";

/** Admin: end (or un-end) a client's subscription in Whop. */
export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { businessId?: string; mode?: "period_end" | "now" | "resume" };
  if (!b.businessId || !b.mode) return NextResponse.json({ success: false, error: "Choose a client and an action." }, { status: 400 });
  if (b.mode === "resume") {
    const r = await resumeSubscription(b.businessId);
    return NextResponse.json({ success: r.ok, error: r.error }, { status: r.ok ? 200 : 502 });
  }
  const r = await cancelSubscription(b.businessId, { atPeriodEnd: b.mode === "period_end", by: "admin" });
  if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: 502 });
  return NextResponse.json({ success: true, immediate: r.immediate, endsAt: r.endsAt ?? null });
}
