import { PRICING, classifyPlan, whopPlanIds, type PlanKey } from "@/lib/billing/whop";

/**
 * Pure sales maths for /admin/sales: turns stored payment events into per-client totals.
 * Works on the billing_events rows the Whop webhook and the "record manual payment" form write.
 */

export interface EventRow {
  event_id?: string;
  type: string;
  email: string | null;
  business_id: string | null;
  created_at: string;
  payload: unknown;
}

export type PaymentKind = "setup" | "monthly" | "minutes" | "other";

export interface PaymentLine {
  at: string;
  businessId: string | null;
  email: string | null;
  kind: PaymentKind;
  plan?: PlanKey;
  amount: number; // dollars
  setup: number; // part of `amount` that is the one-time setup fee
  note: string;
  manual: boolean;
  eventId?: string;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : undefined);

/** Turns one stored event into a payment line, or null when it is not a payment (failed payment, refund alert, ...). */
export function eventToPayment(row: EventRow, ids = whopPlanIds()): PaymentLine | null {
  const payload = isObj(row.payload) ? row.payload : {};
  if (row.type === "manual.payment") {
    const amount = num(payload.amount) ?? 0;
    const plan = typeof payload.plan === "string" ? (payload.plan as PlanKey) : undefined;
    const isSetupPlan = plan === "founding" || plan === "standard";
    const isPack = plan === "minutes200" || plan === "minutes500";
    return {
      at: typeof payload.paidAt === "string" ? payload.paidAt : row.created_at,
      businessId: row.business_id, email: row.email,
      kind: isSetupPlan ? "setup" : isPack ? "minutes" : "other",
      plan: isSetupPlan || isPack ? plan : undefined,
      amount, setup: isSetupPlan ? Math.min(amount, PRICING.setup[plan as "founding" | "standard"]) : 0,
      note: typeof payload.note === "string" ? payload.note : "Manual payment", manual: true, eventId: row.event_id,
    };
  }
  if (row.type !== "whop.payment.succeeded") return null;
  const data = isObj(payload.data) ? payload.data : {};
  const amount = num(data.total) ?? num(data.usd_total) ?? 0;
  const plan = classifyPlan(isObj(data.plan) && typeof data.plan.id === "string" ? data.plan.id : undefined, ids);
  const renewal = data.billing_reason === "subscription_cycle";
  if (plan.kind === "subscription" && plan.key) {
    const setupPart = renewal ? 0 : Math.min(amount, PRICING.setup[plan.key as "founding" | "standard"]);
    return { at: row.created_at, businessId: row.business_id, email: row.email, kind: renewal ? "monthly" : "setup", plan: plan.key, amount, setup: setupPart, note: renewal ? "Monthly renewal" : `Setup fee + first month (${plan.key})`, manual: false, eventId: row.event_id };
  }
  if (plan.kind === "minutes") return { at: row.created_at, businessId: row.business_id, email: row.email, kind: "minutes", plan: plan.key, amount, setup: 0, note: `${plan.minutes}-minute pack`, manual: false, eventId: row.event_id };
  return { at: row.created_at, businessId: row.business_id, email: row.email, kind: "other", amount, setup: 0, note: "Payment for an unrecognised plan", manual: false, eventId: row.event_id };
}

export interface ClientSales {
  businessId: string;
  plan?: PlanKey;
  setupPaid: number;
  subscriptionPaid: number; // monthly part (first month + renewals)
  minutesPaid: number;
  otherPaid: number;
  totalPaid: number;
  paymentCount: number;
  firstPaidAt?: string;
  lastPaidAt?: string;
  lastSubscriptionAt?: string;
  /** Estimate: last subscription payment + 1 month. Exact dates come from Whop when the API key can read memberships. */
  nextRenewalEstimate?: string;
}

export interface SalesSummary {
  perClient: Map<string, ClientSales>;
  unmatched: PaymentLine[];
  totals: { revenue: number; thisMonth: number; setup: number; subscription: number; minutes: number; other: number; payments: number };
}

export function addMonth(iso: string): string {
  const d = new Date(iso);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + 1);
  if (d.getUTCDate() < day) d.setUTCDate(0); // 31 Jan + 1 month -> end of Feb, not March
  return d.toISOString();
}

export function summarizeSales(lines: PaymentLine[], now = new Date()): SalesSummary {
  const perClient = new Map<string, ClientSales>();
  const unmatched: PaymentLine[] = [];
  const totals = { revenue: 0, thisMonth: 0, setup: 0, subscription: 0, minutes: 0, other: 0, payments: 0 };
  const sorted = [...lines].sort((a, b) => a.at.localeCompare(b.at));

  for (const l of sorted) {
    totals.payments++;
    totals.revenue += l.amount;
    const d = new Date(l.at);
    if (d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth()) totals.thisMonth += l.amount;
    if (l.kind === "setup" || l.kind === "monthly") { totals.setup += l.setup; totals.subscription += l.amount - l.setup; }
    else if (l.kind === "minutes") totals.minutes += l.amount;
    else totals.other += l.amount;

    if (!l.businessId) { unmatched.push(l); continue; }
    const c = perClient.get(l.businessId) ?? { businessId: l.businessId, setupPaid: 0, subscriptionPaid: 0, minutesPaid: 0, otherPaid: 0, totalPaid: 0, paymentCount: 0 };
    c.paymentCount++;
    c.totalPaid += l.amount;
    if (l.kind === "setup" || l.kind === "monthly") { c.setupPaid += l.setup; c.subscriptionPaid += l.amount - l.setup; if (l.plan === "founding" || l.plan === "standard") c.plan = l.plan; c.lastSubscriptionAt = l.at; }
    else if (l.kind === "minutes") c.minutesPaid += l.amount;
    else c.otherPaid += l.amount;
    c.firstPaidAt ??= l.at;
    c.lastPaidAt = l.at;
    perClient.set(l.businessId, c);
  }
  for (const c of perClient.values()) if (c.lastSubscriptionAt) c.nextRenewalEstimate = addMonth(c.lastSubscriptionAt);
  const r = (n: number) => Math.round(n * 100) / 100;
  for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] = r(totals[k]);
  for (const c of perClient.values()) { c.setupPaid = r(c.setupPaid); c.subscriptionPaid = r(c.subscriptionPaid); c.minutesPaid = r(c.minutesPaid); c.otherPaid = r(c.otherPaid); c.totalPaid = r(c.totalPaid); }
  return { perClient, unmatched, totals };
}
