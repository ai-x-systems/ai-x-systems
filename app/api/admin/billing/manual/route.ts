import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getStoredBusiness, setBusinessFlags } from "@/lib/config/business-store";
import { creditLedger } from "@/lib/billing/credits";
import { PACK_MINUTES, PLAN_KEYS, type PlanKey } from "@/lib/billing/whop";

export const runtime = "nodejs";

/** Record a payment that did not come through Whop (bank transfer, cash...) so your sales numbers stay complete. */
export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { businessId?: string; plan?: string; amount?: number; note?: string; paidAt?: string; apply?: boolean };

  const amount = Number(b.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) return NextResponse.json({ success: false, error: "Enter the amount paid, in dollars." }, { status: 400 });
  const plan = b.plan === "other" ? "other" : PLAN_KEYS.find((k) => k === b.plan);
  if (!plan) return NextResponse.json({ success: false, error: "Choose what was paid for." }, { status: 400 });
  const stored = b.businessId ? await getStoredBusiness(b.businessId) : null;
  if (b.businessId && !stored) return NextResponse.json({ success: false, error: "That client was not found." }, { status: 404 });
  const paidAt = b.paidAt && !Number.isNaN(Date.parse(b.paidAt)) ? new Date(b.paidAt).toISOString() : new Date().toISOString();
  const note = (b.note ?? "").trim().slice(0, 200) || "Manual payment";

  const { error } = await getSupabaseClient().from("billing_events").insert({
    event_id: `manual:${crypto.randomUUID()}`, type: "manual.payment",
    email: stored?.clientEmail ?? null, business_id: b.businessId ?? null,
    payload: { manual: true, plan, amount, note, paidAt },
  });
  if (error) { console.error("[manual-payment] insert failed:", error); return NextResponse.json({ success: false, error: "Could not save the payment." }, { status: 500 }); }

  // Optionally apply what the payment buys: switch billing on, or credit the minute pack.
  if (b.apply !== false && b.businessId && plan !== "other") {
    if (plan === "founding" || plan === "standard") await setBusinessFlags(b.businessId, { billing_status: "active" });
    const minutes = PACK_MINUTES[plan as PlanKey] ?? 0;
    if (minutes > 0) await creditLedger.recordTransaction(b.businessId, "manual_topup", minutes, `Minute pack (manual payment: ${note})`);
  }
  return NextResponse.json({ success: true });
}

/** Remove a manual entry from the sales list. This only deletes the record: it does not undo billing status or minutes. */
export async function DELETE(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!id.startsWith("manual:")) return NextResponse.json({ success: false, error: "Only manual entries can be removed. Whop payments are your permanent record." }, { status: 400 });
  await getSupabaseClient().from("billing_events").delete().eq("event_id", id).eq("type", "manual.payment");
  return NextResponse.json({ success: true });
}
