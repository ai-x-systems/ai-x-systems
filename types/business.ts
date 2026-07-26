import { BusinessConfig } from "@/lib/config/business-schema";

/**
 * Contract any voice provider must satisfy: turn a business config into
 * whatever payload that provider's API expects to create/update an
 * assistant. Prompt generation, tool definitions, and tool execution never
 * import a provider directly — they only ever go through this shape.
 *
 * Swapping providers later (Retell, Bland, ElevenLabs Conversational,
 * plain Twilio + your own STT/TTS) means adding one new folder under
 * lib/voice/providers/ that implements this interface, and pointing the
 * business config's (future) `voiceProvider` field at it. Nothing else in
 * the app changes.
 */
export interface VoiceProvider {
  buildAssistantConfig(business: BusinessConfig, webhookUrl: string): unknown;
}