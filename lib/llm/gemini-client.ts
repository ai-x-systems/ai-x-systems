import "server-only";
import { LlmMessage, ToolDefinition, ChatCompletionResult, parseOpenAiChatCompletionResponse } from "@/lib/llm/types";

/**
 * lib/llm/gemini-client.ts
 * ---------------------------------------------------------------------
 * Fallback provider only — never called directly by app code. Used
 * exclusively by lib/llm/groq-client.ts's getChatCompletion() when Groq
 * fails specifically due to rate limiting and GEMINI_API_KEY is set. See
 * that file for the fallback decision logic.
 *
 * Uses Google's own OpenAI-compatible endpoint
 * (generativelanguage.googleapis.com/v1beta/openai/chat/completions) —
 * note the required /openai/ path segment: Google's docs originally
 * documented this without it (.../v1beta/chat/completions), which is why
 * an earlier version of this file used that shorter path and got a
 * confusing 403 "project denied" error instead of a clean 404 — same
 * request body shape, same response shape, same Bearer-token auth style
 * as Groq's endpoint otherwise. That's what makes this a clean fallback
 * rather than a second integration to maintain: it reuses
 * parseOpenAiChatCompletionResponse from lib/llm/types.ts unchanged.
 *
 * Get a free key (no card required) at https://aistudio.google.com/apikey
 * and set it as GEMINI_API_KEY. Model is configurable via GEMINI_MODEL
 * (defaults to "gemini-3.6-flash") for the same reason GROQ_MODEL is
 * configurable — a future model deprecation shouldn't require a code
 * change, just an env var update.
 * ---------------------------------------------------------------------
 */

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

interface CallGeminiParams {
  messages: LlmMessage[];
  tools?: ToolDefinition[];
  model: string;
  temperature: number;
  maxTokens: number;
}

export async function callGemini(
  apiKey: string,
  { messages, tools, model, temperature, maxTokens }: CallGeminiParams
): Promise<ChatCompletionResult> {
  console.log("[GEMINI FALLBACK REQUEST]", { model, toolCount: tools?.length ?? 0 });

  let res: Response;
  try {
    res = await fetch(GEMINI_ENDPOINT, {
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
    console.error("[llm] Gemini network error:", err);
    return {
      success: false,
      error: { code: "unknown", message: "The AI service is temporarily unavailable." },
    };
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    console.error(`[llm] Gemini request failed: ${res.status} ${bodyText}`);
    return {
      success: false,
      error: {
        code: res.status === 429 ? "rate_limited" : "request_failed",
        message: "The AI service returned an error. Please try again.",
      },
    };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch (err) {
    console.error("[llm] Gemini response was not valid JSON:", err);
    return {
      success: false,
      error: { code: "invalid_response", message: "Received an invalid response from the AI service." },
    };
  }

  const parsed = parseOpenAiChatCompletionResponse(json);
  if (!parsed) {
    console.error("[llm] Gemini response did not match expected shape:", json);
    return {
      success: false,
      error: { code: "invalid_response", message: "Received an unexpected response from the AI service." },
    };
  }

  return parsed;
}
