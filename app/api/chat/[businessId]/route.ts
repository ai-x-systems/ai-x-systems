import { NextRequest, NextResponse } from "next/server";
import { getBusinessById } from "@/config/businesses";
import { buildSystemPrompt } from "@/lib/prompt/prompt-builder";
import { getChatCompletion, LlmMessage } from "@/lib/llm/groq-client";
import { executeToolCall } from "@/lib/tools/execute-tool-call";
import { TOOL_DEFINITIONS } from "@/lib/tools/tool-definitions";
import { ChatRequestSchema } from "@/lib/chat/chat-request-schema";
import { isRateLimited } from "@/lib/chat/rate-limit";

const MAX_TOOL_ROUNDS = 2; // safety cap so a confused model can't loop indefinitely
const MAX_CONVERSATION_MESSAGES = 20; // trims oldest turns before calling the LLM, bounds cost + context size

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

/**
 * Caps how much conversation gets sent per request. The system prompt is
 * no longer part of this array (getChatCompletion takes it separately), so
 * unlike before there's no "always keep index 0" special case — just trim
 * from the oldest end.
 */
function trimConversation(messages: LlmMessage[]): LlmMessage[] {
  if (messages.length <= MAX_CONVERSATION_MESSAGES) return messages;
  return messages.slice(messages.length - MAX_CONVERSATION_MESSAGES);
}

export async function OPTIONS(
  req: NextRequest,
  { params }: { params: { businessId: string } }
) {
  const business = getBusinessById(params.businessId);
  const origin = req.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin, business?.contact.website),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { businessId: string } }
) {
  const business = getBusinessById(params.businessId);
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin, business?.contact.website);

  if (!business) {
    return NextResponse.json({ error: "Unknown business" }, { status: 404, headers });
  }

  if (isRateLimited(`${business.id}:${clientKey(req)}`)) {
    return NextResponse.json(
      { error: "Too many messages — please slow down and try again shortly." },
      { status: 429, headers }
    );
  }

  let body: { messages: LlmMessage[] };
  try {
    const json = await req.json();
    const parsed = ChatRequestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request.", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers });
  }

  const messages = trimConversation(body.messages);

  try {
    let finalText = "";

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const result = await getChatCompletion({
        systemPrompt: buildSystemPrompt(business),
        messages,
        tools: TOOL_DEFINITIONS,
      });

      if (!result.success) {
        console.error("[chat] llm request failed", {
          business: business.id,
          code: result.error.code,
          message: result.error.message,
        });
        finalText = "Sorry, I'm having trouble responding right now. Please try again.";
        break;
      }

      const { content, toolCalls } = result.message;

      if (!toolCalls || toolCalls.length === 0) {
        finalText = content;
        break;
      }

      messages.push({ role: "assistant", content, tool_calls: toolCalls });

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
        messages.push({ role: "tool", tool_call_id: call.id, content: toolResult });
      }

      if (round === MAX_TOOL_ROUNDS) {
        finalText = "Let me have the team follow up on that to make sure it's handled correctly.";
      }
    }

    return NextResponse.json({ reply: finalText }, { headers });
  } catch (err) {
    console.error("[chat] request failed", {
      business: business.id,
      error: err instanceof Error ? err.message : err,
    });
    return NextResponse.json(
      { error: "Something went wrong. Please try again in a moment." },
      { status: 502, headers }
    );
  }
}