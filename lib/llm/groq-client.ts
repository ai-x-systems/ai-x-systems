import "server-only";

/**
 * lib/llm/groq-client.ts
 * ------------------------------------------------------------------------
 * THE single entry point for every LLM request in this project. No other
 * file should call an LLM provider directly — the website chatbot, the
 * voice layer (via tool-call resolution), and any future AI employee all
 * go through getChatCompletion() below.
 *
 * Provider: Groq (OpenAI-compatible REST API), called via plain fetch —
 * no SDK dependency. Groq's chat completions endpoint follows the OpenAI
 * request/response shape, so this file's job is narrow: build that
 * request, call it, and normalize the result into a shape the rest of the
 * app can use without knowing anything about Groq specifically.
 *
 * Provider independence: every exported type here (LlmMessage,
 * ToolDefinition, ChatCompletionResult) is provider-neutral by name and
 * shape. The only Groq-specific code lives inside callGroq() below. Adding
 * a second provider later means writing one new internal function with the
 * same signature and switching which one getChatCompletion() calls — the
 * same pattern already used for voice providers in lib/voice/types.ts.
 * Do not build that second provider now; this comment just documents the
 * seam for when it's actually needed.
 *
 * This module is server-only: it reads GROQ_API_KEY from the environment
 * and never returns it in any response. The `server-only` import above
 * makes Next.js throw a build error if this file is ever imported into
 * client-bundled code. Requires: `npm install server-only` (a few-byte
 * package that exists purely to enforce this).
 * ------------------------------------------------------------------------
 */

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Defaults used whenever a caller doesn't override them. Change these in
 * one place rather than hardcoding model names or temperatures elsewhere
 * in the project.
 */
export const LLM_DEFAULTS = {
  model: "llama-3.3-70b-versatile",
  temperature: 0.4,
  maxTokens: 1024,
} as const;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type LlmRole = "system" | "user" | "assistant" | "tool";

export interface LlmToolCall {
  id: string;
  function: {
    name: string;
    /** JSON-encoded arguments string, exactly as the provider returns it. */
    arguments: string;
  };
}

export interface LlmMessage {
  role: LlmRole;
  content: string;
  /** Required on role: "tool" messages — which tool call this is a result for. */
  tool_call_id?: string;
  /** Present on assistant messages that requested tool calls. */
  tool_calls?: LlmToolCall[];
}

/**
 * OpenAI/Groq-compatible function-tool schema. Matches the shape already
 * produced by lib/tools/tool-definitions.ts — this file doesn't import
 * that module (LLM client stays decoupled from business tool logic), it
 * just needs the wire shape.
 */
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatCompletionOptions {
  /** Optional — prepended as a system message if provided. */
  systemPrompt?: string;
  /** Conversation so far, oldest first. Do not include the system prompt here. */
  messages: LlmMessage[];
  /** Tool definitions the model may choose to call. Omit if none apply. */
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
  /** Token usage if the provider reported it — useful for cost tracking later. */
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export type LlmErrorCode =
  | "missing_api_key"
  | "request_failed"
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Requests a chat completion from the current LLM provider (Groq).
 *
 * Never throws — all failure modes (missing key, network error, malformed
 * response) come back as a `{ success: false, error }` result so callers
 * can handle them without try/catch. Provider-specific details (HTTP
 * status text, raw error bodies) are logged server-side via console.error
 * and not included in the returned error message.
 *
 * @example Simple completion, no tools
 * ```ts
 * const result = await getChatCompletion({
 *   systemPrompt: buildSystemPrompt(business),
 *   messages: [{ role: "user", content: "What are your hours?" }],
 * });
 * if (result.success) {
 *   console.log(result.message.content);
 * } else {
 *   console.error(result.error.code, result.error.message);
 * }
 * ```
 *
 * @example With tools (caller executes any tool calls and loops)
 * ```ts
 * const result = await getChatCompletion({
 *   systemPrompt: buildSystemPrompt(business),
 *   messages: conversation,
 *   tools: TOOL_DEFINITIONS,
 * });
 * if (result.success && result.message.toolCalls) {
 *   for (const call of result.message.toolCalls) {
 *     const toolResult = await executeToolCall(
 *       { name: call.function.name, arguments: JSON.parse(call.function.arguments) },
 *       business.id
 *     );
 *     conversation.push({ role: "tool", tool_call_id: call.id, content: toolResult });
 *   }
 * }
 * ```
 */
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
    return await callGroq(apiKey, {
      messages,
      tools: options.tools,
      model: options.model ?? LLM_DEFAULTS.model,
      temperature: options.temperature ?? LLM_DEFAULTS.temperature,
      maxTokens: options.maxTokens ?? LLM_DEFAULTS.maxTokens,
    });
  } catch (err) {
    // Network failure, timeout, or anything callGroq didn't already normalize.
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

// ---------------------------------------------------------------------------
// Groq-specific implementation (the only part of this file that would
// change if a provider were ever swapped or added)
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
  { messages, tools, model, temperature, maxTokens }: CallGroqParams
): Promise<ChatCompletionResult> {
  // NOTE ON STREAMING: not implemented yet (out of scope for this
  // milestone). To add it, branch here on a `stream` option, pass
  // `stream: true` in the body below, and read `res.body` as a
  // ReadableStream of SSE chunks instead of calling `res.json()`. Because
  // callers only ever interact with getChatCompletion()'s return shape,
  // adding a streaming variant (e.g. a separate `getChatCompletionStream`
  // that yields chunks) won't require changing any consumer of this
  // function — it would be a pure addition, not a breaking change.
  console.log("[GROQ REQUEST]", {
  model,
  toolCount: tools?.length ?? 0,
  tools,
}); 
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
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    console.error(`[llm] Groq request failed: ${res.status} ${bodyText}`);
    return {
      success: false,
      error: {
        code: "request_failed",
        message: "The AI service returned an error. Please try again.",
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

  const parsed = parseGroqResponse(json);
  if (!parsed) {
    console.error("[llm] Groq response did not match expected shape:", json);
    return {
      success: false,
      error: { code: "invalid_response", message: "Received an unexpected response from the AI service." },
    };
  }

  return parsed;
}

/**
 * Narrow, defensive parsing of Groq's (OpenAI-shaped) response. Returns
 * null rather than throwing if the shape doesn't match what we expect, so
 * callGroq can turn that into a structured error instead of an unhandled
 * exception.
 */
function parseGroqResponse(json: unknown): ChatCompletionSuccess | null {
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
