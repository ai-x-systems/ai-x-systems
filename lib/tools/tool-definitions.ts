/**
 * OpenAI-compatible function/tool definitions. Both Vapi (voice) and Groq
 * (web chat) accept this exact shape, so it's defined once and reused by
 * lib/voice/providers/vapi/assistant-config.ts and
 * app/api/chat/[businessId]/route.ts.
 */
export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "book_appointment",
      description:
        "Book an appointment once the caller/visitor has confirmed a service, day, and time.",
      parameters: {
        type: "object",
        properties: {
          callerName: { type: "string" },
          callerPhone: { type: "string" },
          serviceId: { type: "string", description: "Must match a configured service id." },
          preferredStartTimeISO: {
            type: "string",
            description: "ISO 8601 datetime in the business's local timezone.",
          },
        },
        required: ["callerName", "callerPhone", "serviceId", "preferredStartTimeISO"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "log_lead",
      description:
        "Record contact info and reason for reaching out when not booking directly.",
      parameters: {
        type: "object",
        properties: {
          callerName: { type: "string" },
          callerPhone: { type: "string" },
          reason: { type: "string" },
        },
        required: ["callerName", "reason"],
      },
    },
  },
];
