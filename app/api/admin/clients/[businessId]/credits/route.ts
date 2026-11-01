import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { creditLedger } from "@/lib/billing/credits";
import { CreditTransactionType } from "@/types/account";

export const runtime = "nodejs";

const ALLOWED_TYPES: CreditTransactionType[] = ["manual_topup", "usage", "adjustment"];

/**
 * The manual-billing action itself: you send a Payment Request Link
 * (Elevate Pay / PingPong / Payoneer) directly to the client outside this
 * app, and once it's paid, call this to record the top-up here — this
 * route never talks to a payment processor, on purpose, per the stated
 * "manual link per client" model.
 *
 * @example POST body: { "type": "manual_topup", "amount": 500, "note": "Payoneer PR-0142 paid" }
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  }

  const { businessId } = await context.params;

  let body: { type?: string; amount?: number; note?: string; action?: string; target?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  // "Set the balance to exactly N": records the difference as an adjustment (so reset-to-0 is one click).
  if (body.action === "set") {
    const target = Number(body.target);
    if (!Number.isFinite(target) || target < 0 || target > 1_000_000) {
      return NextResponse.json({ success: false, error: "Enter a balance of 0 or more." }, { status: 400 });
    }
    const current = (await creditLedger.getBalance(businessId)).balance;
    const diff = target - current;
    if (diff === 0) return NextResponse.json({ success: true, balance: await creditLedger.getBalance(businessId) });
    const balance = await creditLedger.recordTransaction(businessId, "adjustment", diff, body.note || `Balance set to ${target} (was ${current})`);
    return NextResponse.json({ success: true, balance });
  }

  if (!body.type || !ALLOWED_TYPES.includes(body.type as CreditTransactionType)) {
    return NextResponse.json(
      { success: false, error: `type must be one of: ${ALLOWED_TYPES.join(", ")}` },
      { status: 400 }
    );
  }
  if (typeof body.amount !== "number" || body.amount === 0 || Number.isNaN(body.amount)) {
    return NextResponse.json(
      { success: false, error: "amount must be a non-zero number." },
      { status: 400 }
    );
  }

  const balance = await creditLedger.recordTransaction(
    businessId,
    body.type as CreditTransactionType,
    body.amount,
    body.note
  );

  return NextResponse.json({ success: true, balance });
}

/** Removes one entry from a client's minutes history (for a mistake, like minutes added by accident). */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  }
  const { businessId } = await context.params;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: "Missing entry id." }, { status: 400 });
  const balance = await creditLedger.deleteTransaction(businessId, id);
  return NextResponse.json({ success: true, balance });
}
