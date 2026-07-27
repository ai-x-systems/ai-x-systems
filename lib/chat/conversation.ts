import "server-only";

/**
 * lib/chat/conversation.ts
 * ---------------------------------------------------------------------
 * Reusable conversation-memory layer, sitting between the HTTP layer
 * (Chat API request/response) and the LLM layer (lib/llm/groq-client.ts).
 *
 * Two halves:
 *
 * 1. Pure functions (normalizeMessages, limitHistory, appendMessage,
 *    prepareForLlm) — stateless history management. This is what the Chat
 *    API uses today, since the API itself is stateless per request (the
 *    client resends the full conversation each turn — see
 *    docs/CHAT-API.md). These functions replace what used to be ad-hoc
 *    array trimming/pushing written directly in the route.
 *
 * 2. ConversationStore — a persistence interface with one in-memory
 *    implementation (createInMemoryConversationStore). NOT wired into the
 *    Chat API yet, and deliberately so: real server-side memory across
 *    requests needs a conversation identifier the client sends back each
 *    time, which is a client-contract change outside this milestone. This
 *    interface exists now so that when that's needed, swapping in Redis,
 *    a database, or vector storage means writing one new implementation
 *    of ConversationStore — no caller (Chat API, future voice memory,
 *    future AI employees) has to change.
 *
 * Server-only: never reads request bodies from client bundles, and the
 * `server-only` import makes Next.js fail the build if this is ever
 * pulled into client-side code.
 * ---------------------------------------------------------------------
 */

import { LlmMessage } from "@/lib/llm/groq-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConversationRole = "system" | "user" | "assistant" | "tool";

export interface ConversationToolCall {
  id: string;
  function: { name: string; arguments: string };
}

/**
 * The canonical in-memory shape for a message anywhere in this app's
 * conversation-handling code. Deliberately a distinct type from LlmMessage
 * (lib/llm/groq-client.ts) even though the fields are identical today —
 * this is the HTTP/business layer's message shape; LlmMessage is the wire
 * format for the LLM provider. Keeping them separate means either can
 * evolve (e.g. adding metadata here) without leaking into the provider
 * call, and vice versa.
 */
export interface ConversationMessage {
  role: ConversationRole;
  content: string;
  tool_call_id?: string;
  tool_calls?: ConversationToolCall[];
  /** ISO 8601. Set automatically by appendMessage/normalizeMessages if omitted. */
  createdAt?: string;
}

export interface ConversationLimits {
  /** Hard cap on message count kept, oldest dropped first. */
  maxMessages: number;
  /** Soft cap on estimated total tokens across kept messages. */
  maxEstimatedTokens: number;
}

/**
 * Defaults chosen to comfortably fit Groq's context window with room for
 * the system prompt and response, while keeping typical per-request cost
 * predictable. Override per-call if a specific channel needs different
 * bounds — don't hardcode different numbers elsewhere in the project.
 */
export const DEFAULT_CONVERSATION_LIMITS: ConversationLimits = {
  maxMessages: 20,
  maxEstimatedTokens: 6000,
};

// ---------------------------------------------------------------------------
// Pure history-management functions
// ---------------------------------------------------------------------------

/**
 * Normalizes raw incoming messages (already schema-validated by
 * ChatRequestSchema — role restricted to "user" | "assistant") into
 * ConversationMessage: trims whitespace, drops any that end up empty, and
 * stamps a receipt timestamp. This is a second, defensive layer, not a
 * replacement for request validation — validation rejects malformed
 * input outright; this normalizes what's already valid.
 *
 * @example
 * ```ts
 * const history = normalizeMessages(body.messages);
 * ```
 */
export function normalizeMessages(
  raw: Array<{ role: ConversationRole; content: string }>
): ConversationMessage[] {
  const now = new Date().toISOString();
  return raw
    .map((m) => ({ role: m.role, content: m.content.trim(), createdAt: now }))
    .filter((m) => m.content.length > 0);
}

/**
 * Rough token estimate (~4 characters per token for English text). Good
 * enough for budget-trimming decisions; not billing-accurate. Swap for a
 * real tokenizer only if precise counting is ever needed.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Keeps the most recent messages within both a message-count cap and an
 * estimated-token budget, always trimming from the oldest end so
 * chronological order within the kept window is preserved.
 *
 * @example
 * ```ts
 * const trimmed = limitHistory(history); // uses DEFAULT_CONVERSATION_LIMITS
 * const trimmed2 = limitHistory(history, { maxMessages: 10, maxEstimatedTokens: 3000 });
 * ```
 */
export function limitHistory(
  messages: ConversationMessage[],
  limits: ConversationLimits = DEFAULT_CONVERSATION_LIMITS
): ConversationMessage[] {
  let trimmed =
    messages.length > limits.maxMessages
      ? messages.slice(messages.length - limits.maxMessages)
      : messages;

  let totalTokens = trimmed.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  while (totalTokens > limits.maxEstimatedTokens && trimmed.length > 1) {
    const [removed, ...rest] = trimmed;
    trimmed = rest;
    totalTokens -= estimateTokens(removed.content);
  }

  return trimmed;
}

/**
 * Appends one message, returning a new array (never mutates the input) so
 * chronological order is always a plain left-to-right read of the result
 * and callers can't accidentally share mutable state across requests.
 * Stamps `createdAt` if the caller didn't provide one.
 *
 * @example
 * ```ts
 * history = appendMessage(history, { role: "assistant", content, tool_calls: toolCalls });
 * ```
 */
export function appendMessage(
  history: ConversationMessage[],
  message: ConversationMessage
): ConversationMessage[] {
  const stamped = message.createdAt ? message : { ...message, createdAt: new Date().toISOString() };
  return [...history, stamped];
}

/** Same as appendMessage, for adding several messages (e.g. multiple tool results) at once. */
export function appendMessages(
  history: ConversationMessage[],
  messages: ConversationMessage[]
): ConversationMessage[] {
  return messages.reduce(appendMessage, history);
}

/**
 * Maps conversation history to the wire shape lib/llm/groq-client.ts
 * expects. A named, explicit step (rather than passing history straight
 * through) so that if the LLM-facing shape ever needs to diverge from the
 * conversation-layer shape — e.g. redacting a field, summarizing older
 * turns — there is exactly one place that does it.
 *
 * @example
 * ```ts
 * const result = await getChatCompletion({
 *   systemPrompt: buildSystemPrompt(business),
 *   messages: prepareForLlm(history),
 *   tools: TOOL_DEFINITIONS,
 * });
 * ```
 */
export function prepareForLlm(history: ConversationMessage[]): LlmMessage[] {
  return history.map((m) => ({
    role: m.role,
    content: m.content,
    tool_call_id: m.tool_call_id,
    tool_calls: m.tool_calls,
  }));
}

// ---------------------------------------------------------------------------
// Persistence seam (not wired into the Chat API yet — see file header)
// ---------------------------------------------------------------------------

export interface ConversationStore {
  get(conversationId: string): Promise<ConversationMessage[]>;
  append(conversationId: string, messages: ConversationMessage[]): Promise<ConversationMessage[]>;
  clear(conversationId: string): Promise<void>;
}

/**
 * In-memory implementation of ConversationStore — the only one that
 * exists today. Each call to this factory returns an independent store, so
 * tests or separate channels can hold isolated state.
 *
 * LIMITATION (same class of caveat as lib/chat/rate-limit.ts): memory is
 * per server instance. On serverless (Vercel), a new instance means empty
 * memory. That's fine as long as nothing depends on this for durability —
 * nothing does yet, since it isn't wired into any route.
 *
 * To replace with Redis/a database/vector storage later: write a new
 * object with the same three async methods (get/append/clear) and use it
 * in place of this factory's return value. No caller signature changes.
 *
 * @example
 * ```ts
 * const store = createInMemoryConversationStore();
 * await store.append("conv_123", [{ role: "user", content: "Hi" }]);
 * const history = await store.get("conv_123");
 * ```
 */
export function createInMemoryConversationStore(): ConversationStore {
  const conversations = new Map<string, ConversationMessage[]>();

  return {
    async get(conversationId) {
      return conversations.get(conversationId) ?? [];
    },
    async append(conversationId, messages) {
      const existing = conversations.get(conversationId) ?? [];
      const updated = appendMessages(existing, messages);
      conversations.set(conversationId, updated);
      return updated;
    },
    async clear(conversationId) {
      conversations.delete(conversationId);
    },
  };
}