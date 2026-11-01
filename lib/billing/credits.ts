import "server-only";
import { getSupabaseClient } from "@/lib/supabase/client";
import { CreditBalance, CreditTransaction, CreditTransactionType } from "@/types/account";

/**
 * lib/billing/credits.ts
 * ---------------------------------------------------------------------
 * Supabase-backed CreditLedger — same interface as before. See
 * supabase/schema.sql for the `credit_transactions` table.
 * ---------------------------------------------------------------------
 */

export interface CreditLedger {
  getBalance(businessId: string): Promise<CreditBalance>;
  recordTransaction(
    businessId: string,
    type: CreditTransactionType,
    amount: number,
    note?: string
  ): Promise<CreditBalance>;
  listAllBalances(): Promise<CreditBalance[]>;
  /** Removes one ledger entry (an admin correcting a mistake). Scoped to the client so another client's entry can't be removed. */
  deleteTransaction(businessId: string, transactionId: string): Promise<CreditBalance>;
}

function rowToTransaction(row: {
  id: string;
  business_id: string;
  type: CreditTransactionType;
  amount: number;
  note: string | null;
  created_at: string;
}): CreditTransaction {
  return {
    id: row.id,
    businessId: row.business_id,
    type: row.type,
    amount: row.amount,
    note: row.note ?? undefined,
    createdAtISO: row.created_at,
  };
}

function balanceFrom(businessId: string, transactions: CreditTransaction[]): CreditBalance {
  return {
    businessId,
    balance: transactions.reduce((sum, t) => sum + t.amount, 0),
    transactions,
  };
}

export function createSupabaseCreditLedger(): CreditLedger {
  const supabase = getSupabaseClient();

  return {
    async getBalance(businessId) {
      const { data, error } = await supabase
        .from("credit_transactions")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return balanceFrom(businessId, (data ?? []).map(rowToTransaction));
    },
    async recordTransaction(businessId, type, amount, note) {
      const { error: insertError } = await supabase
        .from("credit_transactions")
        .insert({ business_id: businessId, type, amount, note: note ?? null });
      if (insertError) throw insertError;
      return this.getBalance(businessId);
    },
    async deleteTransaction(businessId, transactionId) {
      const { error } = await supabase.from("credit_transactions").delete().eq("id", transactionId).eq("business_id", businessId);
      if (error) throw error;
      return this.getBalance(businessId);
    },
    async listAllBalances() {
      const { data, error } = await supabase
        .from("credit_transactions")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      const byBusiness = new Map<string, CreditTransaction[]>();
      for (const row of data ?? []) {
        const t = rowToTransaction(row);
        byBusiness.set(t.businessId, [...(byBusiness.get(t.businessId) ?? []), t]);
      }
      return Array.from(byBusiness.entries()).map(([businessId, txns]) => balanceFrom(businessId, txns));
    },
  };
}

export const creditLedger: CreditLedger = createSupabaseCreditLedger();
