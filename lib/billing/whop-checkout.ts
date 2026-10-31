import "server-only";
import { WhopClient } from "@whop/sdk";
import { whopPlanIds, type PlanKey } from "@/lib/billing/whop";

/** True when a Whop API key is configured, so payment links can be created from /admin and /dashboard. */
export function whopConfigured(): boolean {
  return Boolean(process.env.WHOP_API_KEY);
}

/**
 * Creates a Whop checkout for one plan with the client's id attached. Whop copies the metadata
 * onto the payment, so the webhook knows exactly which client paid, whatever email they typed.
 */
export async function createWhopCheckout(opts: { planKey: PlanKey; businessId: string; redirectUrl?: string }): Promise<{ url: string; id: string }> {
  const token = process.env.WHOP_API_KEY;
  if (!token) throw new Error("WHOP_API_KEY is not set.");
  const client = new WhopClient({ token });
  const res = await client.checkoutConfigurations.create({
    ...(process.env.WHOP_ACCOUNT_ID ? { account_id: process.env.WHOP_ACCOUNT_ID } : {}),
    variant_id: whopPlanIds()[opts.planKey],
    metadata: { business_id: opts.businessId, plan_key: opts.planKey },
    ...(opts.redirectUrl ? { redirect_url: opts.redirectUrl } : {}),
  });
  if (!res.purchase_url) throw new Error("Whop did not return a checkout link.");
  return { url: res.purchase_url, id: res.id };
}
