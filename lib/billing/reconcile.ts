import "server-only";
import { getSupabaseClient } from "@/lib/supabase/client";
import { setBusinessFlags } from "@/lib/config/business-store";
import { creditLedger } from "@/lib/billing/credits";
import { decideWhopAction, paymentId, whopPlanIds } from "@/lib/billing/whop";

/**
 * A client often pays BEFORE their account exists (you send the Whop link, then the setup link). Those
 * payments were stored without a client. When the account is created, apply them: billing becomes active
 * and any minute packs are credited. Safe to run twice: a payment is claimed by writing its business_id.
 */
export async function reconcileUnmatchedPayments(businessId: string, email: string): Promise<{ applied: number }> {
  const db = getSupabaseClient();
  const ids = whopPlanIds();
  const { data } = await db
    .from("billing_events")
    .select("event_id, payload")
    .eq("type", "whop.payment.succeeded")
    .eq("email", email.toLowerCase())
    .is("business_id", null)
    .order("created_at", { ascending: true });

  let applied = 0;
  for (const row of data ?? []) {
    const { data: claimed } = await db.from("billing_events").update({ business_id: businessId }).eq("event_id", row.event_id).is("business_id", null).select("event_id");
    if (!claimed?.length) continue; // someone else got there first
    const payload = row.payload as { data?: unknown } | null;
    const decision = decideWhopAction("payment.succeeded", payload?.data, ids);
    if (decision.minutes > 0) await creditLedger.recordTransaction(businessId, "manual_topup", decision.minutes, `Minute pack purchased before setup (Whop ${paymentId(payload?.data) ?? row.event_id.slice(-8)})`);
    if (decision.status) await setBusinessFlags(businessId, { billing_status: decision.status });
    applied++;
  }
  return { applied };
}
