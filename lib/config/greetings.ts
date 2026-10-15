/**
 * Greetings: pure helpers (no I/O) so they can be unit tested.
 * Three surfaces share one source of truth:
 *   chat   - the first message inside the chat window
 *   bubble - the small callout that pops up beside the chat button
 *   phone  - what the voice assistant says when it picks up
 * Every greeting must make clear it is a virtual assistant: it is honest, it
 * builds trust, and some places require it. A custom greeting that forgets to
 * say so gets the disclosure added rather than silently dropped.
 */

export interface GreetingSource {
  name: string;
  voice: { assistantName: string; greeting?: string };
  chat?: { greeting?: string; bubble?: string };
}

const DISCLOSURE = /\b(virtual|automated|digital)\s+(assistant|receptionist)\b|\bAI\b/i;
const clean = (s?: string) => (s ?? "").replace(/\s+/g, " ").trim();

export const defaultChatGreeting = (name: string, assistant: string) =>
  `Hi, thanks for reaching out to ${name}. I'm ${assistant}, the virtual assistant. What can I help you with today?`;

export const defaultBubble = (name: string) => `👋 Have a question for ${name}? Ask me here.`;

export const defaultPhoneGreeting = (name: string, assistant: string) =>
  `Thanks for calling ${name}, this is ${assistant}, the virtual assistant. How can I help you today?`;

function withDisclosure(text: string, assistant: string): string {
  return DISCLOSURE.test(text) ? text : `${text} I'm ${assistant}, the virtual assistant.`;
}

export function resolveChatGreeting(c: GreetingSource): string {
  const custom = clean(c.chat?.greeting);
  return custom ? withDisclosure(custom, c.voice.assistantName) : defaultChatGreeting(c.name, c.voice.assistantName);
}

export function resolveBubble(c: GreetingSource): string {
  return clean(c.chat?.bubble) || defaultBubble(c.name);
}

/** Phone: the configured greeting is used only if it says it is a virtual assistant; otherwise the safe default. */
export function resolvePhoneGreeting(c: GreetingSource): string {
  const custom = clean(c.voice.greeting);
  return custom && DISCLOSURE.test(custom) ? custom : defaultPhoneGreeting(c.name, c.voice.assistantName);
}
