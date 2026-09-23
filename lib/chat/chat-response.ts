import { NextResponse } from "next/server";

/**
 * lib/chat/chat-response.ts
 * ---------------------------------------------------------------------
 * The Chat API's response contract. One shape for success, one shape for
 * every error — regardless of *why* it failed (validation, rate limit,
 * unknown business, LLM failure, unexpected exception). A frontend only
 * ever needs to branch on `success`, never on status code or error string
 * shape. See docs/CHAT-API.md for the full documented contract.
 * ---------------------------------------------------------------------
 */

export interface ChatApiSuccess {
  success: true;
  reply: string;
  /** True if a lead was logged in this request OR was already logged earlier in the conversation (client should remember and echo this back — see chat-request-schema.ts). */
  leadLogged?: boolean;
}

export type ChatApiErrorCode =
  | "invalid_json"
  | "invalid_request"
  | "unknown_business"
  | "rate_limited"
  | "llm_unavailable"
  | "internal_error";

export interface ChatApiError {
  success: false;
  error: {
    code: ChatApiErrorCode;
    message: string;
    /** Present only for validation errors — zod's flattened field errors. */
    details?: unknown;
  };
}

export type ChatApiResponse = ChatApiSuccess | ChatApiError;

export function chatSuccessResponse(reply: string, headers: HeadersInit, leadLogged?: boolean) {
  const body: ChatApiSuccess = { success: true, reply: sanitizeUrls(reply), leadLogged };
  return NextResponse.json(body, { status: 200, headers });
}

/**
 * Some models (observed with openai/gpt-oss-20b on Groq) occasionally emit
 * "smart typography" dash variants — non-breaking hyphen (U+2011), hyphen
 * (U+2010), figure dash (U+2012), en dash (U+2013) — in place of a plain
 * ASCII "-" when generating a URL, e.g. "ai‑x‑systems‑2.vercel.app" instead
 * of "ai-x-systems-2.vercel.app". Visually near-identical, but a genuinely
 * different domain — the link 404s. This normalizes those characters back
 * to ASCII, but ONLY inside matched URL substrings, so a legitimate em dash
 * used stylistically elsewhere in a sentence (e.g. "already using it —
 * just keep asking") is left untouched.
 */
function sanitizeUrls(text: string): string {
  return text.replace(/https?:\/\/\S+/g, (url) => url.replace(/[\u2010\u2011\u2012\u2013]/g, "-"));
}

export function chatErrorResponse(
  status: number,
  code: ChatApiErrorCode,
  message: string,
  headers: HeadersInit,
  details?: unknown
) {
  const body: ChatApiError = { success: false, error: { code, message, details } };
  return NextResponse.json(body, { status, headers });
}
