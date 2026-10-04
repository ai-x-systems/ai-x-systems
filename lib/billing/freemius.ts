import crypto from "crypto";

/**
 * Freemius signs every webhook with HMAC-SHA256 (hex) of the RAW body using
 * your product's secret key, sent in the `x-signature` header.
 * https://freemius.com/help/documentation/saas/events-webhooks/
 */
export function verifyFreemiusSignature(rawBody: string, signature: string | null, secretKey: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secretKey).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false; // non-hex or length mismatch
  }
}

/**
 * The exact payload shape varies by event, so this looks for the buyer's
 * email defensively: an object under a `user` key first, then any `email`
 * string anywhere in the payload. Verify against a real event (Freemius
 * dashboard → Webhooks → Events, then the "fetch event" API) and tighten
 * if you like — the worst case of a miss is "unmatched", never a wrong client.
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

export type BillingStatus = "awaiting_payment" | "active" | "past_due" | "cancelled" | "refunded";

/** Which billing status (if any) an event type implies. Unknown types change nothing. */
export function statusForEvent(type: string): BillingStatus | undefined {
  switch (type) {
    case "payment.created":
    case "subscription.created":
      return "active";
    case "subscription.renewal.failed.last":
      return "past_due";
    case "subscription.cancelled":
      return "cancelled";
    case "payment.refund":
    case "payment.dispute.lost":
      return "refunded";
    default:
      return undefined;
  }
}

/** Events worth waking the founder for. */
export const ALERT_EVENTS = new Set([
  "payment.created", "subscription.cancelled", "subscription.renewal.failed.last",
  "payment.refund", "payment.dispute.created", "payment.dispute.lost",
]);
