import "server-only";

/**
 * Shared rate limiter. Uses Upstash Redis (REST, no SDK) when
 * UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set, so limits hold
 * across every serverless instance. Without them it falls back to
 * per-instance memory (fine for local dev, NOT a real limit on Vercel).
 *
 * Fails open: if Redis is unreachable we allow the request rather than
 * take the chatbot down, and log the error.
 */

interface Bucket {
  count: number;
  resetAt: number;
}
const memory = new Map<string, Bucket>();

export async function rateLimit(
  key: string,
  max: number,
  windowSec: number
): Promise<{ limited: boolean }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      const res = await fetch(`${url}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify([
          ["INCR", key],
          ["EXPIRE", key, String(windowSec), "NX"],
        ]),
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data = (await res.json()) as Array<{ result?: number }>;
        return { limited: Number(data[0]?.result ?? 0) > max };
      }
      console.error("[rate-limit] Upstash responded", res.status);
    } catch (err) {
      console.error("[rate-limit] Upstash unreachable, failing open:", err);
    }
    return { limited: false };
  }

  const now = Date.now();
  const bucket = memory.get(key);
  if (!bucket || now > bucket.resetAt) {
    memory.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { limited: false };
  }
  bucket.count += 1;
  return { limited: bucket.count > max };
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
