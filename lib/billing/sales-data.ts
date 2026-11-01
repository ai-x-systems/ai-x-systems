import "server-only";
import { getSupabaseClient } from "@/lib/supabase/client";
import { creditLedger } from "@/lib/billing/credits";
import { listCalls } from "@/lib/voice/store";
import { eventToPayment, summarizeSales, type EventRow, type PaymentLine } from "@/lib/billing/sales";

export interface MinutesStats { bought: number; used: number; left: number; vapiCostCents: number }

/** Every payment we know about (Whop webhook + manual entries), oldest first. */
export async function loadPaymentLines(): Promise<PaymentLine[]> {
  const { data, error } = await getSupabaseClient()
    .from("billing_events")
    .select("event_id, type, email, business_id, created_at, payload")
    .in("type", ["whop.payment.succeeded", "manual.payment"])
    .order("created_at", { ascending: true })
    .limit(5000);
  if (error) throw error;
  return ((data ?? []) as EventRow[]).map((r) => eventToPayment(r)).filter((p): p is PaymentLine => !!p);
}

/** Minutes bought / used / left and Vapi cost, per client. */
export async function loadMinutesStats(): Promise<Map<string, MinutesStats>> {
  const [balances, calls] = await Promise.all([creditLedger.listAllBalances(), listCalls(null, 5000)]);
  const out = new Map<string, MinutesStats>();
  for (const b of balances) {
    const bought = b.transactions.filter((t) => t.amount > 0).reduce((n, t) => n + t.amount, 0);
    const used = -b.transactions.filter((t) => t.amount < 0).reduce((n, t) => n + t.amount, 0);
    out.set(b.businessId, { bought, used, left: b.balance, vapiCostCents: 0 });
  }
  for (const c of calls) {
    const m = out.get(c.businessId) ?? { bought: 0, used: 0, left: 0, vapiCostCents: 0 };
    m.vapiCostCents += c.vapiCostCents ?? 0;
    out.set(c.businessId, m);
  }
  return out;
}

export async function loadSales() {
  const lines = await loadPaymentLines();
  return { lines, summary: summarizeSales(lines) };
}
