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

export function chatSuccessResponse(reply: string, headers: HeadersInit) {
  const body: ChatApiSuccess = { success: true, reply };
  return NextResponse.json(body, { status: 200, headers });
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