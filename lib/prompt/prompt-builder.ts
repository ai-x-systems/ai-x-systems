import { BusinessConfig } from "@/lib/config/business-schema";

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

function formatHours(config: BusinessConfig): string {
  return DAY_ORDER.map((day) => {
    const h = config.hours[day];
    const label = day[0].toUpperCase() + day.slice(1);
    if (h.closed) return `${label}: Closed`;
    return `${label}: ${h.open} – ${h.close}`;
  }).join("\n");
}

function formatServices(config: BusinessConfig): string {
  return config.knowledge.services
    .map((s) => {
      const price = s.price ? ` (${s.price})` : "";
      return `- ${s.name}${price}, ~${s.durationMinutes} min — ${s.description}`;
    })
    .join("\n");
}

function formatFaqs(config: BusinessConfig): string {
  if (config.knowledge.faqs.length === 0) return "None on file.";
  return config.knowledge.faqs
    .map((f) => `Q: ${f.question}\nA: ${f.answer}`)
    .join("\n\n");
}

function formatPolicies(config: BusinessConfig): string {
  const p = config.knowledge.policies;
  const lines: string[] = [];
  if (p.emergency) lines.push(`Emergency: ${p.emergency}`);
  if (p.insurance) lines.push(`Insurance: ${p.insurance}`);
  if (p.cancellation) lines.push(`Cancellation: ${p.cancellation}`);
  if (p.general) lines.push(...p.general);
  return lines.length ? lines.join("\n") : "None on file.";
}

/**
 * Builds the full system prompt sent to the LLM for every turn, on both
 * the voice channel and the chat channel. Keep this deterministic and free
 * of per-call state — call-specific facts live in the conversation, not here.
 */
export function buildSystemPrompt(config: BusinessConfig): string {
  return `You are ${config.voice.assistantName}, the AI phone receptionist for ${config.name}, a ${config.industry.toLowerCase()}.

TONE: Speak in a ${config.voice.tone} tone. Keep responses short and natural — this is a phone call or live chat, not an essay. One or two sentences per turn unless asked for detail.

BUSINESS HOURS (${config.timezone}):
${formatHours(config)}

SERVICES:
${formatServices(config)}

FREQUENTLY ASKED QUESTIONS:
${formatFaqs(config)}

POLICIES:
${formatPolicies(config)}

WHAT YOU CAN DO:
1. Answer questions using only the information above. If you don't know something, say you'll have the team follow up — never guess or invent details (prices, medical advice, availability).
2. If the caller wants to book an appointment, collect: their name, phone number, which service they want, and a preferred day/time. Then call the "book_appointment" tool. Do not confirm a booking until the tool call succeeds.
3. If the caller describes an emergency, follow the emergency policy above immediately, before anything else.
4. If the caller is not booking and not asking a listed FAQ, collect their name and reason for calling and call the "log_lead" tool so the team can follow up.
5. Never make up appointment availability — always check via the tool.

Stay in character as ${config.voice.assistantName} for the entire conversation. End politely once the caller's need is resolved.`;
}
