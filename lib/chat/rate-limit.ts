/**
 * Best-effort per-key rate limiting, in-memory.
 *
 * LIMITATION: this only protects a single serverless instance. On Vercel,
 * concurrent or newly-spun-up instances each keep their own counters, so
 * the real ceiling under load is higher than WINDOW_MAX implies. That's an
 * acceptable gap at validation-stage traffic — this exists to blunt a
 * runaway script or a single abusive visitor, not to survive a real attack.
 *
 * If this ever needs to be a hard limit (e.g. once billing is usage-based),
 * swap the body of `isRateLimited` for a shared store — Upstash Redis is
 * the standard pairing with Vercel — and keep the same function signature
 * so nothing calling this needs to change.
 */
const WINDOW_MS = 60_000;
const WINDOW_MAX = 20; // requests per key per minute, per instance

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return false;
  }

  bucket.count += 1;
  return bucket.count > WINDOW_MAX;
}
