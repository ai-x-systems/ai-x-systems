import "server-only";
import type { BusinessConfig } from "@/lib/config/business-schema";
import { buildSystemPrompt } from "@/lib/prompt/prompt-builder";
import { TOOL_DEFINITIONS } from "@/lib/tools/tool-definitions";
import { getEffectiveBusinessConfig } from "@/lib/config/overrides";
import { PHONE_ADDENDUM } from "./pure";

/**
 * Builds the transient assistant returned to Vapi's `assistant-request`.
 * Nothing is stored in Vapi per client: the business config, prompt and tools
 * are the same ones the website chat uses, rebuilt on every inbound call, so
 * an edit in /admin is live on the very next call.
 *
 * Providers are env-overridable so you can swap a model/voice without a deploy:
 *   VOICE_LLM_PROVIDER / VOICE_LLM_MODEL, VOICE_TRANSCRIBER_MODEL,
 *   VOICE_TTS_PROVIDER / VOICE_TTS_VOICE_ID
 */
export async function buildTransientAssistant(
  business: BusinessConfig,
  opts: { webhookUrl: string; maxDurationSeconds: number }
): Promise<Record<string, unknown>> {
  const effective = await getEffectiveBusinessConfig(business);
  const canBook = effective.booking.enabled && effective.booking.appointmentTypes.length > 0;

  // Same rule as the chat prompt: if nothing is bookable, the model must not even see the booking tools.
  const tools = TOOL_DEFINITIONS.filter((t) =>
    canBook ? true : t.function.name === "log_lead"
  ).map((t) => ({ type: "function", function: t.function, server: { url: opts.webhookUrl } }));

  const name = effective.name;
  const assistantName = effective.voice.assistantName;
  const firstMessage = `Thanks for calling ${name}, this is ${assistantName}, the virtual assistant. How can I help you today?`;

  return {
    name: `${assistantName} — ${name}`.slice(0, 40),
    firstMessage,
    model: {
      provider: process.env.VOICE_LLM_PROVIDER || "openai",
      model: process.env.VOICE_LLM_MODEL || "gpt-4o-mini",
      temperature: 0.4,
      messages: [{ role: "system", content: buildSystemPrompt(effective) + PHONE_ADDENDUM }],
      tools,
    },
    voice: {
      provider: process.env.VOICE_TTS_PROVIDER || "vapi",
      voiceId: process.env.VOICE_TTS_VOICE_ID || "Elliot",
    },
    transcriber: { provider: "deepgram", model: process.env.VOICE_TRANSCRIBER_MODEL || "nova-3", language: "en" },
    server: { url: opts.webhookUrl },
    serverMessages: ["tool-calls", "end-of-call-report"],
    maxDurationSeconds: opts.maxDurationSeconds,
    silenceTimeoutSeconds: 30,
    // Privacy/consent default: don't store audio. Transcripts are still produced.
    artifactPlan: { recordingEnabled: false },
    endCallMessage: "Thank you for calling. Goodbye!",
  };
}
