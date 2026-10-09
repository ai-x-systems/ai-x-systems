import { NextRequest } from "next/server";
import { getStoredBusiness } from "@/lib/config/business-store";
import { getEffectiveBusinessConfig } from "@/lib/config/overrides";
import { buildSystemPrompt } from "@/lib/prompt/prompt-builder";
import { getChatCompletion } from "@/lib/llm/groq-client";
import { executeToolCall } from "@/lib/tools/execute-tool-call";
import { TOOL_DEFINITIONS } from "@/lib/tools/tool-definitions";
import { ChatRequestSchema } from "@/lib/chat/chat-request-schema";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";
import { runInBackground } from "@/lib/utils/background";
import { sendFounderAlert } from "@/lib/integrations/notify";
import { isDemoId } from "@/lib/onboarding/build-config";
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
// Room for the LLM retry + tool rounds + after() background work (emails, webhooks).
export const maxDuration = 30;

const MAX_TOOL_ROUNDS = 2; // safety cap so a confused model can't loop indefinitely

function corsHeaders(origin: string | null, allowedOrigin?: string) {
  const allow = allowedOrigin && origin?.includes(allowedOrigin) ? origin! : allowedOrigin ?? "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS(
  req: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await context.params;
  const business = (await getStoredBusiness(businessId))?.config;
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
  const stored = await getStoredBusiness(businessId);
  const business = stored?.config;
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin, business?.contact.website);

  if (!business) {
    return chatErrorResponse(404, "unknown_business", "This business could not be found.", headers);
  }

  // Generated previews: small daily cap so a shared link can't burn the AI quota.
  const isPreview = !!stored && stored.source === "db" && stored.config.demo && isDemoId(stored.config.id);

  // Admin can pause a client (unpaid, cancelled, on request). Visitors get a
  // polite message instead of an error.
  if (stored && !stored.active) {
    return chatSuccessResponse(
      "Our assistant is offline right now. Please reach out to the team directly and they'll be happy to help.",
      headers
    );
  }

  const [perVisitor, perBusinessDay] = await Promise.all([
    rateLimit(`chat:${business.id}:${clientIp(req)}`, 20, 60),
    // Hard daily ceiling per business so one script can't burn the whole
    // LLM quota. Override with CHAT_DAILY_CAP_PER_BUSINESS.
    rateLimit(`chat-day:${business.id}`, isPreview ? 150 : Number(process.env.CHAT_DAILY_CAP_PER_BUSINESS) || 3000, 86400),
  ]);
  if (perVisitor.limited || perBusinessDay.limited) {
    return chatErrorResponse(
      429,
      "rate_limited",
      "Too many messages — please slow down and try again shortly.",
      headers
    );
  }

  let body: {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    leadAlreadyLogged?: boolean;
  };
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

  // The single most valuable signal for you: a prospect is trying their preview right now.
  if (isPreview && history.filter((m) => m.role === "user").length === 1) {
    const bizName = business.name;
    runInBackground(async () => {
      if ((await rateLimit(`preview-ping:${business.id}`, 1, 3600)).limited) return;
      await sendFounderAlert(`Someone is trying the preview for ${bizName}`, [`A visitor just started chatting with the preview built for ${bizName}.`, "If you emailed this prospect, follow up while it is fresh."]);
    });
  }
  let leadLogged = body.leadAlreadyLogged === true;

  try {
    let finalText = "";
    const effectiveBusiness = await getEffectiveBusinessConfig(business);
    const systemPrompt = buildSystemPrompt(effectiveBusiness);

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const result = await getChatCompletion({
        systemPrompt,
        messages: prepareForLlm(history),
        tools: TOOL_DEFINITIONS,
      });

      if (!result.success) {
        console.error("[chat] llm request failed", {
          business: business.id,
          code: result.error.code,
          message: result.error.message,
        });
        // Use the specific message when we have a genuinely useful one for
        // the visitor (e.g. "please try again in a few seconds" on a rate
        // limit) — otherwise fall back to the generic wording. Previously
        // this always showed the generic message regardless of cause,
        // which made a transient, retry-worthy rate limit look identical
        // to a hard failure.
        const userMessage =
          (result.error.code === "request_failed" || result.error.code === "rate_limited") &&
          result.error.message.length < 120
            ? result.error.message
            : "Sorry, I'm having trouble responding right now. Please try again.";
        return chatErrorResponse(502, "llm_unavailable", userMessage, headers);
      }

      const { content, toolCalls } = result.message;

      if (!toolCalls || toolCalls.length === 0) {
        // A model (especially OpenRouter's rotating free pool, which
        // varies in quality) can return an empty/whitespace-only final
        // reply. Sending that straight to the client was worse than a
        // one-off bad reply: the client stores it in its own local chat
        // history, and every message after that resends the FULL history
        // — including that empty entry — which the request schema
        // correctly rejects every time (content must be non-empty). Once
        // it happened, that browser tab's conversation was permanently
        // broken until reload. Substituting a safe fallback here means an
        // empty model reply is never allowed to exist in the first place.
        finalText = content.trim() || "Could you say that again? I didn't quite catch that.";
        break;
      }

      // Snapshot BEFORE appending this turn's own assistant/tool_calls
      // message — executeToolCall's duplicate-log_lead check needs to see
      // only tool calls from EARLIER turns. Passing the post-append
      // `history` here made every log_lead call, including the very
      // first one in a conversation, look like a duplicate of itself.
      const historyBeforeThisTurn = history;
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
          business.id,
          historyBeforeThisTurn,
          leadLogged
        );
        if (toolResult.leadLogged) leadLogged = true;
        history = appendMessage(history, { role: "tool", tool_call_id: call.id, content: toolResult.message });
      }

      if (round === MAX_TOOL_ROUNDS) {
        finalText = "Let me have the team follow up on that to make sure it's handled correctly.";
      }
    }

    return chatSuccessResponse(finalText, headers, leadLogged);
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
