import "server-only";
import { callOpenRouter } from "@/lib/llm/openrouter-client";
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
 * their own file only to break a circular import with the fallback
 * provider (the fallback client needs these same types/parser, and this
 * file needs to call the fallback client — see lib/llm/types.ts's header
 * for why that combination can't live in one file safely).
 *
 * MODEL: configurable via GROQ_MODEL env var, defaulting to
 * "openai/gpt-oss-20b". Making this an env var, not just a hardcoded
 * string, means a future Groq deprecation can be worked around with a
 * Vercel environment variable change and a redeploy — no code change
 * needed.
 *
 * FALLBACK: if Groq fails specifically due to rate limiting and
 * OPENROUTER_API_KEY is set, this automatically retries the same request
 * against OpenRouter's free router before giving up. See
 * lib/llm/openrouter-client.ts. (A previous version of this fallback used
 * Gemini — see that file's git history / lib/llm/gemini-client.ts, now
 * unused — swapped out after its endpoint kept returning an unresolved
 * account-side 403.)
 *
 * WHY GROQ STAYS PRIMARY even on a zero-budget setup: Groq's free tier
 * caps tokens PER MINUTE (8000/min observed), which resets every minute
 * and adds up to a much higher effective daily ceiling than OpenRouter's
 * free tier, which caps requests PER DAY (50/day on a bare key, 1000/day
 * after a one-time $10 top-up). Making OpenRouter primary would trade a
 * bursty-but-high-volume free tier for a hard, low, daily ceiling — worse
 * for a live business chatbot even though it removes Groq's per-minute
 * math. Groq primary + OpenRouter as the fallback keeps both tiers' free
 * budgets independent and additive instead of picking the smaller one.
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

const MAX_RETRIES = 1;
const MAX_RETRY_WAIT_MS = 4000;

export const LLM_DEFAULTS = {
  model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
  temperature: 0.4,
  maxTokens: 1024,
};

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

    if (!groqResult.success && groqResult.error.code === "rate_limited" && process.env.OPENROUTER_API_KEY) {
      console.warn("[llm] Groq rate-limited — falling back to OpenRouter");
      const openRouterResult = await callOpenRouter(process.env.OPENROUTER_API_KEY, {
        messages,
        tools: options.tools,
        model: process.env.OPENROUTER_MODEL || "openrouter/free",
        temperature: options.temperature ?? LLM_DEFAULTS.temperature,
        maxTokens: options.maxTokens ?? LLM_DEFAULTS.maxTokens,
      });
      if (openRouterResult.success) return openRouterResult;
      console.error("[llm] OpenRouter fallback also failed:", openRouterResult.error);
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

function parseRetryAfterMs(bodyText: string): number | null {
  const match = bodyText.match(/try again in ([\d.]+)s/i);
  if (!match) return null;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.ceil(seconds * 1000) + 250;
}

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
    type: "function",
    function: { name, arguments: JSON.stringify(args) },
  };
}

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

    if (res.status === 429 && attempt <= MAX_RETRIES) {
      const waitMs = Math.min(parseRetryAfterMs(bodyText) ?? 3000, MAX_RETRY_WAIT_MS);
      console.warn(`[llm] Groq 429 — retrying (attempt ${attempt + 1}) in ${waitMs}ms`);
      await sleep(waitMs);
      return callGroq(apiKey, { messages, tools, model, temperature, maxTokens }, attempt + 1);
    }

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
