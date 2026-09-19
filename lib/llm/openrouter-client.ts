import "server-only";
import { LlmMessage, ToolDefinition, ChatCompletionResult, parseOpenAiChatCompletionResponse } from "@/lib/llm/types";

/**
 * lib/llm/openrouter-client.ts
 * ---------------------------------------------------------------------
 * Fallback provider — replaces the earlier Gemini fallback (see git
 * history / lib/llm/gemini-client.ts, now unused and safe to delete).
 * Gemini's endpoint kept returning a 403 "project denied" that couldn't
 * be resolved even after fixing the endpoint path, and looked like an
 * account-side restriction outside this codebase's control. OpenRouter's
 * free router is a cleaner fit for a zero-budget setup anyway: one free
 * key, no card, and it internally rotates across 25+ free models with
 * automatic fallback between them — get a key at
 * https://openrouter.ai/keys (leave billing empty) and set it as
 * OPENROUTER_API_KEY.
 *
 * Uses OpenRouter's OpenAI-compatible endpoint
 * (openrouter.ai/api/v1/chat/completions) with model "openrouter/free" —
 * OpenRouter's own router that auto-selects among free models, filtering
 * for ones that support the request's needs (tool calling included, per
 * OpenRouter's docs). Same request/response shape as Groq's endpoint, so
 * this reuses parseOpenAiChatCompletionResponse from lib/llm/types.ts
 * unchanged, same as the Gemini file did.
 *
 * NO retry-on-429 here, unlike Groq. OpenRouter's free tier's binding
 * constraint is a DAILY cap (50 requests/day on a bare free key, 1000/day
 * after a one-time $10 credit top-up per OpenRouter's docs) — a few
 * seconds' wait cannot help a daily cap the way it helps Groq's
 * per-minute one, so retrying here would only add latency for no benefit.
 * Model overridable via OPENROUTER_MODEL for the same reason GROQ_MODEL
 * and GEMINI_MODEL are — to survive a future model/router rename without
 * a code change.
 * ---------------------------------------------------------------------
 */

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

interface CallOpenRouterParams {
  messages: LlmMessage[];
  tools?: ToolDefinition[];
  model: string;
  temperature: number;
  maxTokens: number;
}

export async function callOpenRouter(
  apiKey: string,
  { messages, tools, model, temperature, maxTokens }: CallOpenRouterParams
): Promise<ChatCompletionResult> {
  console.log("[OPENROUTER FALLBACK REQUEST]", { model, toolCount: tools?.length ?? 0 });

  let res: Response;
  try {
    res = await fetch(OPENROUTER_ENDPOINT, {
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
  } catch (err) {
    console.error("[llm] OpenRouter network error:", err);
    return {
      success: false,
      error: { code: "unknown", message: "The AI service is temporarily unavailable." },
    };
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    console.error(`[llm] OpenRouter request failed: ${res.status} ${bodyText}`);
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
    console.error("[llm] OpenRouter response was not valid JSON:", err);
    return {
      success: false,
      error: { code: "invalid_response", message: "Received an invalid response from the AI service." },
    };
  }

  const parsed = parseOpenAiChatCompletionResponse(json);
  if (!parsed) {
    console.error("[llm] OpenRouter response did not match expected shape:", json);
    return {
      success: false,
      error: { code: "invalid_response", message: "Received an unexpected response from the AI service." },
    };
  }

  return parsed;
}
