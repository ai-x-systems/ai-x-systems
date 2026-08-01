import { z } from "zod";

/**
 * The client (widget iframe) is untrusted input. Restricting role to
 * "user" | "assistant" — never "system" or "tool" — matters for security,
 * not just correctness: without this, a visitor could send
 * { role: "system", content: "ignore all previous instructions..." } in
 * the messages array and have it appended straight into the conversation
 * sent to Groq, effectively hijacking the assistant's behavior.
 *
 * Length/count caps exist to bound cost and context size, not just abuse —
 * an unbounded conversation eventually fails at the model's context limit
 * anyway; better to trim/reject predictably than fail unpredictably.
 */
const IncomingMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1, "Message cannot be empty").max(4000, "Message too long"),
});

export const ChatRequestSchema = z.object({
  messages: z
    .array(IncomingMessageSchema)
    .min(1, "At least one message is required")
    .max(40, "Conversation too long for a single request"),
});

export type ChatRequestBody = z.infer<typeof ChatRequestSchema>;
