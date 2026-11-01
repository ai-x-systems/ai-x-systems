import "server-only";
import { getSupabaseClient } from "@/lib/supabase/client";
import { deleteBusinessRow, getStoredBusiness } from "@/lib/config/business-store";

/**
 * Permanently removes a client and everything that belongs only to them: login, phone line, calls,
 * minutes ledger, leads log, chat settings and the setup link. Payment records (billing_events) are KEPT
 * on purpose so your sales history stays correct; they just show the client as deleted.
 */
export async function deleteClient(businessId: string, opts: { allowActiveBilling?: boolean } = {}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const stored = await getStoredBusiness(businessId);
  if (!stored) return { ok: false, status: 404, error: "Unknown client." };
  if (stored.source !== "db") return { ok: false, status: 400, error: "This business lives in your code files, so it can't be deleted from here." };
  if (stored.billingStatus === "active" && !stored.config.demo && !opts.allowActiveBilling) {
    return { ok: false, status: 409, error: "This client is still on an active subscription. Cancel it first (Sales → Cancel), or confirm that you want to delete them anyway." };
  }
  const db = getSupabaseClient();
  const steps: Array<[string, PromiseLike<{ error: unknown }>]> = [
    ["voice_calls", db.from("voice_calls").delete().eq("business_id", businessId)],
    ["voice_lines", db.from("voice_lines").delete().eq("business_id", businessId)],
    ["credit_transactions", db.from("credit_transactions").delete().eq("business_id", businessId)],
    ["activity_log", db.from("activity_log").delete().eq("business_id", businessId)],
    ["business_overrides", db.from("business_overrides").delete().eq("business_id", businessId)],
    ["accounts", db.from("accounts").delete().eq("business_id", businessId).eq("role", "client")],
    ["client_intakes", db.from("client_intakes").delete().eq("business_id", businessId)],
  ];
  for (const [table, op] of steps) {
    const { error } = await op;
    if (error) console.error(`[delete-client] ${table}:`, error); // keep going: a partly-removed client is worse than a logged hiccup
  }
  await deleteBusinessRow(businessId);
  return { ok: true };
}
