/**
 * lib/llm/types.ts
 * ---------------------------------------------------------------------
 * Shared types and response parser for every OpenAI-compatible LLM
 * provider in this project (currently Groq and its Gemini fallback).
 * Pulled out of lib/llm/groq-client.ts specifically so that file and
 * lib/llm/gemini-client.ts don't import from each other — a fallback
 * provider importing its own caller is the kind of circular import that
 * works today by accident and breaks in a way that's hard to diagnose
 * the moment either file's top-level code changes.
 * ---------------------------------------------------------------------
 */

export type LlmRole = "system" | "user" | "assistant" | "tool";

export interface LlmToolCall {
  id: string;
  /**
   * Always "function" today (the only tool_call type OpenAI-compatible
   * APIs currently define), but required, not optional — Groq validates
   * this field is present on every tool_calls entry in the CONVERSATION
   * HISTORY sent with the next request, not just on the entry it itself
   * returns. A hand-constructed LlmToolCall (see
   * lib/llm/groq-client.ts's recoverFailedToolCall) that omits this field
   * passes fine when created, then makes the *next* request in the same
   * conversation fail with a confusing, unrelated-looking 400 once that
   * entry is echoed back as history — this happened in production.
   */
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface LlmMessage {
  role: LlmRole;
  content: string;
  tool_call_id?: string;
  tool_calls?: LlmToolCall[];
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatCompletionOptions {
  systemPrompt?: string;
  messages: LlmMessage[];
  tools?: ToolDefinition[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatCompletionSuccess {
  success: true;
  message: {
    role: "assistant";
    content: string;
    toolCalls?: LlmToolCall[];
  };
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export type LlmErrorCode =
  | "missing_api_key"
  | "request_failed"
  | "rate_limited"
  | "invalid_response"
  | "unknown";

export interface ChatCompletionFailure {
  success: false;
  error: {
    code: LlmErrorCode;
    message: string;
  };
}

export type ChatCompletionResult = ChatCompletionSuccess | ChatCompletionFailure;

/**
 * Shared response parser — both Groq and Gemini (via its OpenAI-compatible
 * endpoint) return this exact response shape, so one parser serves both.
 */
export function parseOpenAiChatCompletionResponse(json: unknown): ChatCompletionSuccess | null {
  if (typeof json !== "object" || json === null) return null;
  const choices = (json as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const message = (choices[0] as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) return null;

  const content = (message as { content?: unknown }).content;
  const toolCalls = (message as { tool_calls?: unknown }).tool_calls;

  const usageRaw = (json as { usage?: unknown }).usage;
  const usage =
    typeof usageRaw === "object" && usageRaw !== null
      ? {
          promptTokens: Number((usageRaw as Record<string, unknown>).prompt_tokens ?? 0),
          completionTokens: Number((usageRaw as Record<string, unknown>).completion_tokens ?? 0),
          totalTokens: Number((usageRaw as Record<string, unknown>).total_tokens ?? 0),
        }
      : undefined;

  return {
    success: true,
    message: {
      role: "assistant",
      content: typeof content === "string" ? content : "",
      toolCalls: Array.isArray(toolCalls) ? (toolCalls as LlmToolCall[]) : undefined,
    },
    usage,
  };
}
