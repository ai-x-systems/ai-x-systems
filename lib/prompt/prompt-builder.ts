import { BusinessConfig } from "@/lib/config/business-schema";
import { buildBusinessKnowledge, getKnowledgeSection } from "@/lib/knowledge/knowledge-builder";
import { BusinessKnowledge, KnowledgeSectionId } from "@/types/knowledge";

/**
 * Sources a section's text from the Knowledge Builder, falling back to
 * "None on file." when a section has no data — the exact wording this
 * prompt used before the Knowledge Builder existed. This function changes
 * *where* the text comes from, not what the prompt ever says.
 */
function textOrFallback(knowledge: BusinessKnowledge, id: KnowledgeSectionId): string {
  const found = getKnowledgeSection(knowledge, id);
  return !found || found.isEmpty ? "None on file." : found.text;
}

/**
 * Today's date rendered in the business's timezone, e.g. "Saturday, August
 * 15, 2026". The LLM has no reliable knowledge of the current date on its
 * own (observed: it booked a "next Tuesday" request for the wrong year), so
 * the prompt must state it explicitly for the model to resolve relative
 * dates ("today", "next Tuesday", "August 18th") against a real calendar.
 * Falls back to a UTC date string if the business timezone is somehow
 * invalid, so a bad config can never break prompt construction.
 */
function formatTodayInBusinessTimezone(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: timezone,
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Builds the full system prompt sent to the LLM for every turn, on both
 * the voice channel and the chat channel. Keep this deterministic and free
 * of per-call state — call-specific facts live in the conversation, not here.
 *
 * Business knowledge (hours, services, FAQs, policies) is sourced from
 * lib/knowledge/knowledge-builder.ts rather than formatted here directly.
 * That module also builds "company", "pricing", and "booking" sections,
 * not used in this prompt today — see its file header for why.
 */
export function buildSystemPrompt(config: BusinessConfig): string {
  const knowledge = buildBusinessKnowledge(config);

  const hours = textOrFallback(knowledge, "hours");
  const services = textOrFallback(knowledge, "services");
  const faqs = textOrFallback(knowledge, "faqs");
  const policies = textOrFallback(knowledge, "policies");

  return `You are ${config.voice.assistantName}, the AI phone receptionist for ${config.name}, a ${config.industry.toLowerCase()}.

TODAY'S DATE (${config.timezone}): ${formatTodayInBusinessTimezone(config.timezone)}. Resolve every date the caller mentions ("today", "tomorrow", "next Tuesday", "August 18th") against this actual date and year — never guess or assume a different year.

TONE: Speak in a ${config.voice.tone} tone. Keep responses short and natural — this is a phone call or live chat, not an essay. One or two sentences per turn unless asked for detail.

BUSINESS HOURS (${config.timezone}):
${hours}

SERVICES:
${services}

FREQUENTLY ASKED QUESTIONS:
${faqs}

POLICIES:
${policies}

WHAT YOU CAN DO:
1. Answer questions using only the information above. If you don't know something, say you'll have the team follow up — never guess or invent details (prices, medical advice, availability).
2. If the caller wants to book an appointment, collect: their name, phone number, which service they want, and a preferred day/time — all four, before calling "book_appointment". If the caller hasn't yet provided every one of these, continue the conversation naturally and keep asking — do not call any tool yet, and never guess, invent, or pass a placeholder such as "unknown" for any argument. Each service above is listed with a bracketed [serviceId: ...] — use that exact id (not the service name) as the "serviceId" argument. Never say the serviceId out loud or mention it to the caller; refer to services only by name in conversation. Do not confirm a booking until the tool call succeeds.
3. If the caller describes an emergency, follow the emergency policy above immediately, before anything else.
4. If the caller is not booking and not asking a listed FAQ, collect their name and reason for calling and call the "log_lead" tool so the team can follow up.
5. Never make up appointment availability — always check via the tool.

Stay in character as ${config.voice.assistantName} for the entire conversation. End politely once the caller's need is resolved.`;
}
