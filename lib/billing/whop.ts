import { extractBuyerEmail, type BillingStatus } from "@/lib/billing/freemius";

/**
 * Pure helpers for the Whop billing webhook (no network, no database, so they are unit-tested).
 *
 * Plan ids are not secrets. They default to the plans created in the Whop dashboard and can be
 * overridden with env vars if a plan is ever recreated.
 */

export type PlanKey = "founding" | "standard" | "minutes200" | "minutes500";
export const PLAN_KEYS: PlanKey[] = ["founding", "standard", "minutes200", "minutes500"];

/** Voice minutes added by each one-time pack (1 credit = 1 minute). */
export const PACK_MINUTES: Partial<Record<PlanKey, number>> = { minutes200: 200, minutes500: 500 };

export const PLAN_LABELS: Record<PlanKey, string> = {
  founding: "Founding client ($348 today, then $149/mo)",
  standard: "Standard ($448 today, then $149/mo)",
  minutes200: "200 voice minutes ($50)",
  minutes500: "500 voice minutes ($110)",
};

export function whopPlanIds(env: Record<string, string | undefined> = process.env): Record<PlanKey, string> {
  return {
    founding: env.WHOP_PLAN_FOUNDING || "plan_cjXCgAuwSjXAJ",
    standard: env.WHOP_PLAN_STANDARD || "plan_wvpAXOyDQAZRa",
    minutes200: env.WHOP_PLAN_MINUTES_200 || "plan_YsoxfGM8340y3",
    minutes500: env.WHOP_PLAN_MINUTES_500 || "plan_7BojRTibaBUhe",
  };
}

export type PlanKind = "subscription" | "minutes" | "unknown";

export function classifyPlan(planId: string | undefined, ids: Record<PlanKey, string>): { key?: PlanKey; kind: PlanKind; minutes: number } {
  if (!planId) return { kind: "unknown", minutes: 0 };
  const key = PLAN_KEYS.find((k) => ids[k] === planId);
  if (!key) return { kind: "unknown", minutes: 0 };
  if (key === "founding" || key === "standard") return { key, kind: "subscription", minutes: 0 };
  return { key, kind: "minutes", minutes: PACK_MINUTES[key] ?? 0 };
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export function paymentId(data: unknown): string | undefined {
  return isObj(data) ? str(data.id) : undefined;
}

export function paymentPlanId(data: unknown): string | undefined {
  return isObj(data) && isObj(data.plan) ? str(data.plan.id) : undefined;
}

/** The client id our own checkout link attached (copied by Whop onto the payment's metadata). */
export function metadataBusinessId(data: unknown): string | undefined {
  return isObj(data) && isObj(data.metadata) ? str(data.metadata.business_id) : undefined;
}

export function paymentEmail(data: unknown): string | undefined {
  if (isObj(data) && isObj(data.user)) {
    const e = str(data.user.email);
    if (e) return e.toLowerCase();
  }
  return extractBuyerEmail(data);
}

export function formatAmount(data: unknown): string {
  if (!isObj(data)) return "unknown amount";
  const total = typeof data.total === "number" ? data.total : typeof data.usd_total === "number" ? data.usd_total : undefined;
  const cur = (str(data.currency) ?? "usd").toUpperCase();
  return total === undefined ? "unknown amount" : `${total.toFixed(2)} ${cur}`;
}

export interface WhopDecision {
  kind: PlanKind;
  planKey?: PlanKey;
  status?: BillingStatus; // billing status to set on the matched client
  minutes: number; // voice minutes to credit to the matched client
  alert: boolean; // email the founder
  note: string; // one line for the founder alert
}

/** Events the webhook subscribes to. Anything else is acknowledged and ignored. */
export const WHOP_EVENTS = ["payment.succeeded", "payment.failed", "refund.created", "dispute.created"] as const;

/**
 * What a Whop event means. It never pauses anyone: a failed renewal only marks "past due" and a
 * refund or dispute only emails you, so a surprising payload can't switch off a paying client.
 */
export function decideWhopAction(type: string, data: unknown, ids: Record<PlanKey, string>): WhopDecision {
  const plan = classifyPlan(paymentPlanId(data), ids);
  const base = { kind: plan.kind, planKey: plan.key, minutes: 0, alert: true } as const;
  switch (type) {
    case "payment.succeeded":
      if (plan.kind === "subscription") return { ...base, status: "active", note: `Payment received for the ${plan.key} plan (${formatAmount(data)}).` };
      if (plan.kind === "minutes") return { ...base, minutes: plan.minutes, note: `Payment received for a ${plan.minutes}-minute pack (${formatAmount(data)}).` };
      return { ...base, note: `Payment received (${formatAmount(data)}) for a plan this system does not recognise, so nothing was changed.` };
    case "payment.failed": {
      const renewal = isObj(data) && data.billing_reason === "subscription_cycle";
      if (plan.kind === "subscription" && renewal) return { ...base, status: "past_due", note: `A monthly renewal payment failed (${formatAmount(data)}). Billing is marked past due.` };
      return { ...base, note: `A payment attempt failed (${formatAmount(data)}). No status change was made.` };
    }
    case "refund.created":
      return { ...base, note: "A refund was issued. No status or minutes were changed: review the client in /admin." };
    case "dispute.created":
      return { ...base, note: "A dispute (chargeback) was opened. Respond in Whop and review the client in /admin." };
    default:
      return { kind: "unknown", minutes: 0, alert: false, note: `Ignored event ${type}.` };
  }
}
