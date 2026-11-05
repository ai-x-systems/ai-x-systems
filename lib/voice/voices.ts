/**
 * The built-in Vapi voices a client may choose from. Taken from Vapi's list of active voices
 * (docs.vapi.ai/providers/voice/vapi-voices); retired voices such as Kylie and Lily are NOT offered.
 * A pure file so it can be used by forms, the server and tests alike.
 */
export interface VoiceOption { id: string; label: string; gender: "Female" | "Male"; accent: string; feel: string }

export const VOICES: VoiceOption[] = [
  { id: "Savannah", label: "Savannah", gender: "Female", accent: "American", feel: "natural, friendly" },
  { id: "Emma", label: "Emma", gender: "Female", accent: "American", feel: "natural, friendly" },
  { id: "Layla", label: "Layla", gender: "Female", accent: "American", feel: "natural, friendly" },
  { id: "Clara", label: "Clara", gender: "Female", accent: "American", feel: "natural, professional" },
  { id: "Elliot", label: "Elliot", gender: "Male", accent: "Canadian", feel: "natural, calm" },
  { id: "Kai", label: "Kai", gender: "Male", accent: "American", feel: "natural, helpful" },
  { id: "Neil", label: "Neil", gender: "Male", accent: "American", feel: "natural, friendly" },
  { id: "Sid", label: "Sid", gender: "Male", accent: "American", feel: "natural, calm" },
];

export const DEFAULT_VOICE_ID = "Elliot";
export const isKnownVoice = (id: string | undefined): id is string => !!id && VOICES.some((v) => v.id === id);

/**
 * The voice block for the Vapi assistant. No choice (or an unknown one) keeps today's behaviour exactly:
 * the env default, else Elliot. A chosen voice uses Vapi's newer, more natural "version 2".
 */
export function voiceFor(chosen: string | undefined, env: Record<string, string | undefined> = process.env) {
  const provider = env.VOICE_TTS_PROVIDER || "vapi";
  if (provider === "vapi" && isKnownVoice(chosen)) return { provider, voiceId: chosen, version: 2 };
  return { provider, voiceId: env.VOICE_TTS_VOICE_ID || DEFAULT_VOICE_ID };
}
