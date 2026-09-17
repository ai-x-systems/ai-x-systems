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
