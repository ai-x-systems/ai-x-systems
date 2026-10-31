/** Billing states a client can be in (stored on the client record). */
export type BillingStatus = "awaiting_payment" | "active" | "past_due" | "cancelled" | "refunded";

/**
 * Best-effort buyer email from any payment payload: an email under a `user` key first, then any
 * email anywhere. The worst case of a miss is "unmatched" (you are told), never a wrong client.
 */
export function extractBuyerEmail(payload: unknown): string | undefined {
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const seen = new Set<unknown>();
  let anyEmail: string | undefined;

  const walk = (node: unknown, underUser: boolean): string | undefined => {
    if (!node || typeof node !== "object" || seen.has(node)) return undefined;
    seen.add(node);
    const obj = node as Record<string, unknown>;
    if (typeof obj.email === "string" && EMAIL.test(obj.email)) {
      if (underUser) return obj.email.toLowerCase();
      anyEmail ??= obj.email.toLowerCase();
    }
    for (const [k, v] of Object.entries(obj)) {
      const hit = walk(v, underUser || k === "user");
      if (hit) return hit;
    }
    return undefined;
  };

  return walk(payload, false) ?? anyEmail;
}
