import { after } from "next/server";

/**
 * Runs work AFTER the HTTP response is sent, but keeps the serverless
 * function alive until it finishes. A bare `void promise()` does NOT do
 * this on Vercel: the instance can freeze the moment the response returns,
 * silently killing in-flight SMTP/webhook calls. That is the most likely
 * root cause of the "isolated Gmail timeout" — emails were racing the
 * function freeze. Falls back to fire-and-forget outside a request
 * (scripts, tests).
 */
export function runInBackground(task: () => Promise<unknown>): void {
  const safe = async () => {
    try {
      await task();
    } catch (err) {
      console.error("[background] task failed:", err);
    }
  };
  try {
    after(safe);
  } catch {
    void safe();
  }
}
