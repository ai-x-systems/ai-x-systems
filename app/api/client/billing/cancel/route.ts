import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/accounts/session";
import { cancelSubscription, resumeSubscription } from "@/lib/billing/subscription";
import { rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/**
 * Client: stop renewals (they keep access until the end of the month they paid for) or change their mind.
 * If Whop can't be reached the request is recorded and you are emailed, so a cancellation is never lost.
 */
export async function POST(req: NextRequest) {
  const session = await getClientSession();
  if (!session?.businessId) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  if ((await rateLimit(`cancel:${session.businessId}`, 6, 3600)).limited) return NextResponse.json({ success: false, error: "Too many attempts. Please try again later." }, { status: 429 });

  const b = (await req.json().catch(() => ({}))) as { action?: string; reason?: string };
  if (b.action === "resume") {
    const r = await resumeSubscription(session.businessId);
    return NextResponse.json({ success: r.ok, error: r.error }, { status: r.ok ? 200 : 502 });
  }
  if (b.action !== "cancel") return NextResponse.json({ success: false, error: "Bad request." }, { status: 400 });
  const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, 500) : undefined;
  const r = await cancelSubscription(session.businessId, { atPeriodEnd: true, by: "client", reason });
  if (!r.ok) return NextResponse.json({ success: false, noted: r.noted, error: r.error }, { status: r.noted ? 202 : 502 });
  return NextResponse.json({ success: true, endsAt: r.endsAt ?? null });
}
