/**
 * OpenAI-compatible function/tool definitions. Both Vapi (voice) and Groq
 * (web chat) accept this exact shape, so it's defined once and reused by
 * lib/voice/providers/vapi/assistant-config.ts and
 * app/api/chat/[businessId]/route.ts.
 *
 * Deliberately NO "required" arrays on any of these. Groq's own function-
 * calling layer enforces "required" strictly server-side: if the model
 * calls a tool before it actually has every required field, Groq rejects
 * the entire completion with a 400 tool_use_failed error — before
 * lib/tools/execute-tool-call.ts's own field-by-field validation (which
 * handles this gracefully, e.g. "Before I can book that, I still need
 * your name") ever gets a chance to run. That 400 surfaced as a hard,
 * unrecoverable chat failure in production. Leaving every field optional
 * here means an incomplete/premature tool call is always allowed through
 * to our own code, which is the only place that should decide what to do
 * about missing data.
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
          serviceId: {
            type: "string",
            
              "The service's internal id shown as [serviceId: ...] next to each service in the system prompt — not the service's display name.",
          },
          preferredStartTimeISO: {
            type: "string",
            description: "ISO 8601 datetime in the business's local timezone.",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "save_confirmation_email",
      description:
        "Save the caller's email so a booking confirmation can be sent, after book_appointment has already succeeded. Never use this to create or modify a booking — it only records an email address for an existing confirmed appointment.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "The caller's email address." },
          serviceName: {
            type: "string",
            description: "The display name of the already-booked service (not the serviceId).",
          },
          confirmedStartTimeISO: {
            type: "string",
            description: "The confirmedStartTimeISO returned by the earlier book_appointment call.",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "log_lead",
      description:
        "Record contact info and reason for reaching out when not booking directly. Always include the caller's email once they've provided it — email is this business's primary follow-up contact method.",
      parameters: {
        type: "object",
        properties: {
          callerName: { type: ["string", "null"] },
          callerPhone: { type: ["string", "null"] },
          callerEmail: { type: ["string", "null"], description: "The caller's email address, once they've provided it." },
          reason: { type: ["string", "null"] },
        },
      },
    },
  },
];
