/**
 * OpenAI-compatible function/tool definitions. Both Vapi (voice) and Groq
 * (web chat) accept this exact shape, so it's defined once and reused by
 * lib/voice/providers/vapi/assistant-config.ts and
 * app/api/chat/[businessId]/route.ts.
 *
 * Deliberately NO "required" arrays on any of these — see the block below
 * this one for why.
 *
 * Deliberately `type: ["string", "null"]` on every field the model might
 * not have a value for yet, instead of plain `type: "string"`. Observed in
 * production: the model sometimes emits a literal JSON `null` for a field
 * it doesn't have (e.g. `"callerPhone": null`) rather than omitting the
 * key entirely. `null` doesn't satisfy `type: "string"` under strict JSON
 * Schema validation, so Groq rejected the whole tool call with a 400
 * before lib/tools/execute-tool-call.ts's own null-safe checks (which
 * already handle `null` fine — `isMissingOrPlaceholder` treats it the same
 * as missing) ever got a chance to run. Allowing `null` at the schema
 * level, on top of already not requiring these fields, closes both halves
 * of "the model hasn't collected this yet" — an omitted key and an
 * explicit `null` value are now equally valid.
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
          callerName: { type: ["string", "null"] },
          callerPhone: { type: ["string", "null"] },
          serviceId: {
            type: ["string", "null"],
            description:
              "The service's internal id shown as [serviceId: ...] next to each service in the system prompt — not the service's display name.",
          },
          preferredStartTimeISO: {
            type: ["string", "null"],
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
          email: { type: ["string", "null"], description: "The caller's email address." },
          serviceName: {
            type: ["string", "null"],
            description: "The display name of the already-booked service (not the serviceId).",
          },
          confirmedStartTimeISO: {
            type: ["string", "null"],
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
        "Record contact info and reason for reaching out when not booking directly. Always include the caller's email once they've provided it — email is this business's primary follow-up contact method. Only include callerPhone when the visitor is specifically interested in the AI Voice Receptionist — leave it out for AI Website Assistant / chatbot-only interest.",
      parameters: {
        type: "object",
        properties: {
          callerName: { type: ["string", "null"] },
          callerPhone: {
            type: ["string", "null"],
            description: "Only collect and include this for AI Voice Receptionist interest — never for chatbot-only interest.",
          },
          callerEmail: {
            type: ["string", "null"],
            description: "The caller's email address, once they've provided it.",
          },
          serviceInterest: {
            type: ["string", "null"],
            description: "Which service the visitor wants: 'AI Voice Receptionist', 'AI Website Assistant', 'Both', or null if unspecified.",
          },
          reason: { type: ["string", "null"] },
        },
      },
    },
  },
];
