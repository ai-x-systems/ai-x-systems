import { NextRequest } from "next/server";
import { getBusinessById } from "@/config/businesses";
import { buildSystemPrompt } from "@/lib/prompt/prompt-builder";
import { getChatCompletion } from "@/lib/llm/groq-client";
import { executeToolCall } from "@/lib/tools/execute-tool-call";
import { TOOL_DEFINITIONS } from "@/lib/tools/tool-definitions";
import { ChatRequestSchema } from "@/lib/chat/chat-request-schema";
import { isRateLimited } from "@/lib/chat/rate-limit";
import { chatSuccessResponse, chatErrorResponse } from "@/lib/chat/chat-response";
import {
  normalizeMessages,
  limitHistory,
  appendMessage,
  prepareForLlm,
} from "@/lib/chat/conversation";

/**
 * app/api/chat/[businessId]/route.ts
 * ---------------------------------------------------------------------
 * The production Chat API. This is what public/widget.js (via the embed
 * iframe) calls, and the only place website-chat conversations touch the
 * LLM. Voice (Vapi) is a separate channel with its own route and never
 * calls this one, but both funnel through the same Prompt Builder, Tool
 * Definitions, and Tool Executor.
 *
 * Runtime: pinned to Node.js explicitly (not Edge). The Business Loader
 * reads data/businesses/*.json off disk via `fs`, which Edge doesn't
 * support — this line exists so nobody accidentally breaks that by adding
 * `export const runtime = "edge"` later.
 *
 * Method handling: only POST (and the CORS preflight OPTIONS) are
 * exported. Next.js's App Router automatically returns 405 with a
 * correct `Allow` header for any other method — no extra code needed for
 * that.
 *
 * Full request/response contract: docs/CHAT-API.md
 * ---------------------------------------------------------------------
 */
export const runtime = "nodejs";

const MAX_TOOL_ROUNDS = 2; // safety cap so a confused model can't loop indefinitely

function corsHeaders(origin: string | null, allowedOrigin?: string) {
  const allow = allowedOrigin && origin?.includes(allowedOrigin) ? origin! : allowedOrigin ?? "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function clientKey(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function OPTIONS(
  req: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await context.params;
  const business = getBusinessById(businessId);
  const origin = req.headers.get("origin");
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin, business?.contact.website),
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await context.params;
  const business = getBusinessById(businessId);
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin, business?.contact.website);

  if (!business) {
    return chatErrorResponse(404, "unknown_business", "This business could not be found.", headers);
  }

  if (isRateLimited(`${business.id}:${clientKey(req)}`)) {
    return chatErrorResponse(
      429,
      "rate_limited",
      "Too many messages — please slow down and try again shortly.",
      headers
    );
  }

  let body: { messages: Array<{ role: "user" | "assistant"; content: string }> };
  try {
    const json = await req.json();
    const parsed = ChatRequestSchema.safeParse(json);
    if (!parsed.success) {
      return chatErrorResponse(
        400,
        "invalid_request",
        "The request body did not match the expected format.",
        headers,
        parsed.error.flatten()
      );
    }
    body = parsed.data;
  } catch {
    return chatErrorResponse(400, "invalid_json", "Request body must be valid JSON.", headers);
  }

  let history = limitHistory(normalizeMessages(body.messages));

  try {
    let finalText = "";

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const result = await getChatCompletion({
        systemPrompt: buildSystemPrompt(business),
        messages: prepareForLlm(history),
        tools: TOOL_DEFINITIONS,
      });

      if (!result.success) {
        console.error("[chat] llm request failed", {
          business: business.id,
          code: result.error.code,
          message: result.error.message,
        });
        return chatErrorResponse(
          502,
          "llm_unavailable",
          "Sorry, I'm having trouble responding right now. Please try again.",
          headers
        );
      }

      const { content, toolCalls } = result.message;

      if (!toolCalls || toolCalls.length === 0) {
        finalText = content;
        break;
      }

      history = appendMessage(history, { role: "assistant", content, tool_calls: toolCalls });

      for (const call of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments);
        } catch {
          console.error("[chat] failed to parse tool call arguments", {
            business: business.id,
            tool: call.function.name,
          });
        }

        const toolResult = await executeToolCall(
          { name: call.function.name, arguments: args },
          business.id
        );
        history = appendMessage(history, { role: "tool", tool_call_id: call.id, content: toolResult });
      }

      if (round === MAX_TOOL_ROUNDS) {
        finalText = "Let me have the team follow up on that to make sure it's handled correctly.";
      }
    }

    return chatSuccessResponse(finalText, headers);
  } catch (err) {
    console.error("[chat] request failed", {
      business: business.id,
      error: err instanceof Error ? err.message : err,
    });
    return chatErrorResponse(
      500,
      "internal_error",
      "Something went wrong. Please try again in a moment.",
      headers
    );
  }
}
