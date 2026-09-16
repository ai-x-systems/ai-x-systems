import "server-only";
import { callGemini } from "@/lib/llm/gemini-client";
import {
  LlmMessage,
  LlmToolCall,
  ToolDefinition,
  ChatCompletionOptions,
  ChatCompletionResult,
  parseOpenAiChatCompletionResponse,
} from "@/lib/llm/types";

/**
 * lib/llm/groq-client.ts
 * ------------------------------------------------------------------------
 * THE single entry point for every LLM request in this project. No other
 * file should call an LLM provider directly.
 *
 * Re-exports every type from lib/llm/types.ts so existing imports
 * elsewhere in the app (e.g. `import { LlmMessage } from
 * "@/lib/llm/groq-client"`) keep working unchanged — the types moved to
 * their own file only to break a circular import with the Gemini fallback
 * (gemini-client.ts needs these same types/parser, and this file needs to
 * call gemini-client.ts — see lib/llm/types.ts's header for why that
 * combination can't live in one file safely).
 *
 * MODEL: configurable via GROQ_MODEL env var, defaulting to
 * "openai/gpt-oss-20b". Making this an env var, not just a hardcoded
 * string, means a future Groq deprecation can be worked around with a
 * Vercel environment variable change and a redeploy — no code change
 * needed.
 *
 * FALLBACK: if Groq fails specifically due to rate limiting and
 * GEMINI_API_KEY is set, this automatically retries the same request
 * against Gemini's free, OpenAI-compatible endpoint before giving up. See
 * lib/llm/gemini-client.ts.
 * ------------------------------------------------------------------------
 */

export type {
  LlmRole,
  LlmToolCall,
  LlmMessage,
  ToolDefinition,
  ChatCompletionOptions,
  ChatCompletionSuccess,
  LlmErrorCode,
  ChatCompletionFailure,
  ChatCompletionResult,
} from "@/lib/llm/types";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

// Vercel's default serverless function timeout is 10s on the Hobby plan.
// The PREVIOUS version of this retry logic used Groq's own suggested wait
// time uncapped — which can be 20+ seconds under heavier throttling (seen
// live: "please try again in 22.8675s") — so the function itself could be
// killed mid-sleep before ever attempting the retry, which is the most
// likely cause of "book an appointment" failing outright rather than
// succeeding on retry. Capping the wait tightly, and limiting to one
// retry, keeps the worst case (one real request + one capped wait + one
// retry request) comfortably under 10s even on Hobby.
const MAX_RETRIES = 1;
const MAX_RETRY_WAIT_MS = 4000;

export const LLM_DEFAULTS = {
  model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
  temperature: 0.4,
  maxTokens: 1024,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getChatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: {
        code: "missing_api_key",
        message: "The LLM provider is not configured (missing API key).",
      },
    };
  }

  const messages: LlmMessage[] = options.systemPrompt
    ? [{ role: "system", content: options.systemPrompt }, ...options.messages]
    : options.messages;

  try {
    const groqResult = await callGroq(apiKey, {
      messages,
      tools: options.tools,
      model: options.model ?? LLM_DEFAULTS.model,
      temperature: options.temperature ?? LLM_DEFAULTS.temperature,
      maxTokens: options.maxTokens ?? LLM_DEFAULTS.maxTokens,
    });

    // Fallback to Gemini ONLY when Groq specifically failed due to rate
    // limiting (not on a bad-request, auth, or unknown error — falling
    // back on those would just mask a real bug behind a second provider).
    // Gemini's own free tier is currently more generous than Groq's for
    // sustained/bursty traffic, so this meaningfully reduces how often a
    // visitor ever sees a rate-limit message at all, without abandoning
    // Groq's speed as the default path.
    if (!groqResult.success && groqResult.error.code === "rate_limited" && process.env.GEMINI_API_KEY) {
      console.warn("[llm] Groq rate-limited — falling back to Gemini");
      const geminiResult = await callGemini(process.env.GEMINI_API_KEY, {
        messages,
        tools: options.tools,
        model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
        temperature: options.temperature ?? LLM_DEFAULTS.temperature,
        maxTokens: options.maxTokens ?? LLM_DEFAULTS.maxTokens,
      });
      if (geminiResult.success) return geminiResult;
      console.error("[llm] Gemini fallback also failed:", geminiResult.error);
      // Both providers failed — return Groq's result since its message is
      // the one already tuned for display to the visitor (see
      // app/api/chat/[businessId]/route.ts).
      return groqResult;
    }

    return groqResult;
  } catch (err) {
    console.error("[llm] unexpected error calling Groq:", err);
    return {
      success: false,
      error: {
        code: "unknown",
        message: "The AI service is temporarily unavailable. Please try again.",
      },
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Groq's 429 body includes a human-readable hint like "Please try again in
 * 2.175s." — parsed here so the retry waits exactly that long (plus a small
 * buffer for clock drift) instead of a blind guess. Falls back to null
 * (caller uses its own default) if the message doesn't match, since this
 * wording isn't a documented, stable API contract.
 */
function parseRetryAfterMs(bodyText: string): number | null {
  const match = bodyText.match(/try again in ([\d.]+)s/i);
  if (!match) return null;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.ceil(seconds * 1000) + 250;
}

/**
 * Parses Groq's 400 tool_use_failed error body and reconstructs the tool
 * call the model was actually trying to make, so it can be routed through
 * our own null-safe validation instead of being lost entirely. Returns
 * null for any error shape that isn't this specific case (e.g. a genuine
 * malformed generation with no failed_generation field, or a completely
 * different 400 cause) — those still fall through to the generic failure.
 */
function recoverFailedToolCall(bodyText: string): LlmToolCall | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return null;
  }

  const error = (parsed as { error?: unknown })?.error;
  if (typeof error !== "object" || error === null) return null;

  const code = (error as { code?: unknown }).code;
  const failedGeneration = (error as { failed_generation?: unknown }).failed_generation;
  if (code !== "tool_use_failed" || typeof failedGeneration !== "string") return null;

  let call: unknown;
  try {
    call = JSON.parse(failedGeneration);
  } catch {
    return null;
  }

  const name = (call as { name?: unknown })?.name;
  const args = (call as { arguments?: unknown })?.arguments;
  if (typeof name !== "string" || typeof args !== "object" || args === null) return null;

  return {
    id: `recovered-${Date.now()}`,
    function: { name, arguments: JSON.stringify(args) },
  };
}

// ---------------------------------------------------------------------------
// Groq-specific implementation
// ---------------------------------------------------------------------------

interface CallGroqParams {
  messages: LlmMessage[];
  tools?: ToolDefinition[];
  model: string;
  temperature: number;
  maxTokens: number;
}

async function callGroq(
  apiKey: string,
  { messages, tools, model, temperature, maxTokens }: CallGroqParams,
  attempt: number = 1
): Promise<ChatCompletionResult> {
  console.log("[GROQ REQUEST]", { model, toolCount: tools?.length ?? 0, attempt });
  const res = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: "auto",
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    console.error(`[llm] Groq request failed: ${res.status} ${bodyText}`);

    // Groq's free/on-demand tier enforces a tokens-per-minute cap, not a
    // per-request cap — a burst (e.g. a long conversation history plus a
    // big system prompt) can transiently exceed it even though a request
    // a few seconds later, once the per-minute window rolls over, would
    // succeed. One automatic retry with a short, capped backoff (see
    // MAX_RETRY_WAIT_MS above) turns that into an invisible delay instead
    // of a visible failure.
    if (res.status === 429 && attempt <= MAX_RETRIES) {
      const waitMs = Math.min(parseRetryAfterMs(bodyText) ?? 3000, MAX_RETRY_WAIT_MS);
      console.warn(`[llm] Groq 429 — retrying (attempt ${attempt + 1}) in ${waitMs}ms`);
      await sleep(waitMs);
      return callGroq(apiKey, { messages, tools, model, temperature, maxTokens }, attempt + 1);
    }

    // Groq's own tool-calling layer strictly validates a tool call's
    // arguments against the declared JSON Schema server-side, and rejects
    // the ENTIRE request with a 400 "tool_use_failed" if the model's call
    // doesn't match (e.g. a `null` for a field schema'd as plain
    // "string") — even when lib/tools/tool-definitions.ts already widens
    // that field to accept null. Rather than trust that every future
    // schema tweak keeps satisfying Groq's specific validator, recover
    // directly: Groq includes `failed_generation`, the exact tool call the
    // model tried to make. Parse it and feed it through the normal
    // tool-call path — lib/tools/execute-tool-call.ts's own validation
    // already treats `null`/missing fields correctly (asks the visitor for
    // what's missing instead of crashing) — so this makes the chat
    // resilient to Groq's tool-call validation regardless of the specific
    // reason it rejected the call.
    const recovered = recoverFailedToolCall(bodyText);
    if (recovered) {
      console.warn("[llm] Recovered a tool call Groq rejected at the schema-validation layer:", recovered.function.name);
      return {
        success: true,
        message: { role: "assistant", content: "", toolCalls: [recovered] },
      };
    }

    return {
      success: false,
      error: {
        code: res.status === 429 ? "rate_limited" : "request_failed",
        message:
          res.status === 429
            ? "I'm getting a lot of requests right now — please try that again in a few seconds."
            : "The AI service returned an error. Please try again.",
      },
    };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch (err) {
    console.error("[llm] Groq response was not valid JSON:", err);
    return {
      success: false,
      error: { code: "invalid_response", message: "Received an invalid response from the AI service." },
    };
  }

  const parsed = parseOpenAiChatCompletionResponse(json);
  if (!parsed) {
    console.error("[llm] Groq response did not match expected shape:", json);
    return {
      success: false,
      error: { code: "invalid_response", message: "Received an unexpected response from the AI service." },
    };
  }

  return parsed;
}
