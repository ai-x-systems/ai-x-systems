import "server-only";
import { WhopClient } from "@whop/sdk";
import { getSupabaseClient } from "@/lib/supabase/client";
import { setBusinessFlags } from "@/lib/config/business-store";
import { sendFounderAlert } from "@/lib/integrations/notify";
import { siteConfig } from "@/lib/site-config";
import { classifyPlan, membershipIdOf, paymentPlanId, whopPlanIds } from "@/lib/billing/whop";

export interface SubscriptionInfo {
  membershipId: string;
  status?: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
  manageUrl?: string | null;
}

function client(): WhopClient | null {
  const token = process.env.WHOP_API_KEY;
  return token ? new WhopClient({ token }) : null;
}

/** The Whop membership of this client's subscription (not a one-time minute pack), found from their payments. */
export async function findSubscriptionMembershipId(businessId: string): Promise<string | null> {
  const ids = whopPlanIds();
  const { data } = await getSupabaseClient()
    .from("billing_events")
    .select("payload")
    .eq("business_id", businessId)
    .eq("type", "whop.payment.succeeded")
    .order("created_at", { ascending: false })
    .limit(30);
  for (const row of data ?? []) {
    const payload = row.payload as { data?: unknown } | null;
    if (classifyPlan(paymentPlanId(payload?.data), ids).kind !== "subscription") continue;
    const id = membershipIdOf("payment.succeeded", payload?.data);
    if (id) return id;
  }
  return null;
}

/** Live details from Whop when the API key may read memberships; otherwise just the id (callers fall back to estimates). */
export async function getSubscriptionInfo(businessId: string): Promise<SubscriptionInfo | null> {
  const membershipId = await findSubscriptionMembershipId(businessId);
  if (!membershipId) return null;
  const c = client();
  if (!c) return { membershipId };
  try {
    const m = await c.memberships.retrieve({ id: membershipId });
    return { membershipId, status: m.status, cancelAtPeriodEnd: m.cancel_at_period_end, currentPeriodEnd: m.current_period_end, manageUrl: m.manage_url };
  } catch (err) {
    console.error("[subscription] could not read membership:", err);
    return { membershipId };
  }
}

type Result = { ok: true; immediate: boolean; endsAt?: string | null } | { ok: false; error: string; noted: boolean };

async function record(businessId: string, kind: string, payload: Record<string, unknown>) {
  await getSupabaseClient().from("billing_events").insert({ event_id: `app:${kind}:${crypto.randomUUID()}`, type: `app.${kind}`, business_id: businessId, payload });
}

/**
 * Ends a client's subscription in Whop. `atPeriodEnd` keeps access until the paid month is over.
 * If Whop can't be reached (no key / missing permission), the request is NOT lost: you are emailed to do it by hand.
 */
export async function cancelSubscription(businessId: string, opts: { atPeriodEnd: boolean; by: "client" | "admin"; reason?: string }): Promise<Result> {
  const origin = siteConfig.brand.baseUrl.replace(/\/+$/, "");
  const alertManual = async (why: string) => {
    await sendFounderAlert(`Cancellation request: ${businessId}`, [
      `${opts.by === "client" ? "The client" : "You"} asked to end the subscription for "${businessId}" (${opts.atPeriodEnd ? "at the end of the paid period" : "immediately"}).`,
      `It could not be done automatically: ${why}. Cancel it in Whop → Customers.`,
      opts.reason ? `Reason given: ${opts.reason}` : "No reason given.",
      `${origin}/admin/sales`,
    ]).catch(() => undefined);
  };

  const membershipId = await findSubscriptionMembershipId(businessId);
  const c = client();
  if (!membershipId || !c) {
    await record(businessId, "cancel_requested", { by: opts.by, atPeriodEnd: opts.atPeriodEnd, reason: opts.reason ?? null, automatic: false });
    await alertManual(!c ? "WHOP_API_KEY is not set" : "no Whop subscription was found for this client");
    return { ok: false, noted: true, error: "We couldn't cancel this automatically, but your request has been recorded and we'll take care of it." };
  }
  try {
    const m = await c.memberships.cancel({ id: membershipId, cancel_at_period_end: opts.atPeriodEnd, ...(opts.reason ? { reason: opts.reason.slice(0, 500) } : {}) });
    await record(businessId, "cancelled", { by: opts.by, atPeriodEnd: opts.atPeriodEnd, reason: opts.reason ?? null, membershipId });
    if (!opts.atPeriodEnd) await setBusinessFlags(businessId, { billing_status: "cancelled" });
    await sendFounderAlert(`Subscription ${opts.atPeriodEnd ? "will end" : "cancelled"}: ${businessId}`, [
      `${opts.by === "client" ? "The client cancelled" : "You cancelled"} the subscription for "${businessId}" ${opts.atPeriodEnd ? "(access continues to the end of the paid period)" : "(effective immediately)"}.`,
      opts.reason ? `Reason: ${opts.reason}` : "No reason given.",
      `${origin}/admin/sales`,
    ]).catch(() => undefined);
    return { ok: true, immediate: !opts.atPeriodEnd, endsAt: m.current_period_end };
  } catch (err) {
    console.error("[subscription] cancel failed:", err);
    await record(businessId, "cancel_requested", { by: opts.by, atPeriodEnd: opts.atPeriodEnd, reason: opts.reason ?? null, automatic: false });
    await alertManual("Whop refused the request (check the API key has the 'Cancel memberships' permission)");
    return { ok: false, noted: true, error: "We couldn't cancel this automatically, but your request has been recorded and we'll take care of it." };
  }
}

/** Undo a scheduled cancellation (the client changed their mind before the period ended). */
export async function resumeSubscription(businessId: string): Promise<{ ok: boolean; error?: string }> {
  const membershipId = await findSubscriptionMembershipId(businessId);
  const c = client();
  if (!membershipId || !c) return { ok: false, error: "We couldn't find your subscription. Please contact us." };
  try {
    await c.memberships.update({ id: membershipId, cancel_at_period_end: false });
    await record(businessId, "resumed", { membershipId });
    return { ok: true };
  } catch (err) {
    console.error("[subscription] resume failed:", err);
    return { ok: false, error: "We couldn't undo the cancellation automatically. Please contact us." };
  }
}
