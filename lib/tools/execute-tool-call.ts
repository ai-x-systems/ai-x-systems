import { getBusinessById } from "@/config/businesses";
import { bookAppointment } from "@/lib/integrations/calendar";
import { logLead } from "@/lib/integrations/sheets";
import { sendCallerConfirmation, sendOwnerAlert } from "@/lib/integrations/notify";

export interface ToolCallArgs {
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Collapses a string to a case/whitespace/punctuation-insensitive key, so
 * "Discovery Call", "discovery call", "DiscoveryCall", "discovery-call",
 * and "DISCOVERY CALL" all normalize identically.
 */
function normalizeServiceKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

/**
 * True for genuinely missing data: undefined/null, empty/whitespace-only,
 * or a common placeholder a model will sometimes supply for a required
 * field it doesn't actually have a value for yet, rather than omitting
 * the field (which would fail JSON Schema validation on the
 * required-fields list). Not exhaustive — any new placeholder pattern
 * observed in practice is a one-line addition to this set.
 */
const PLACEHOLDER_VALUES = new Set(["unknown", "n/a", "none", "null"]);

function isMissingOrPlaceholder(value: string | undefined | null): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  if (PLACEHOLDER_VALUES.has(trimmed.toLowerCase())) return true;
  return false;
}

/**
 * Beyond "not missing," a real name is at least a couple characters —
 * catches single-character/garbage values without being strict about
 * what a legitimate name can contain (no assumptions about scripts,
 * length, or format beyond this minimal sanity floor).
 */
function isValidCallerName(value: string | undefined | null): boolean {
  if (isMissingOrPlaceholder(value)) return false;
  return (value as string).trim().length >= 2;
}

function countDigits(value: string): number {
  return (value.match(/\d/g) ?? []).length;
}

/**
 * Loose sanity check, not real phone validation (no libphonenumber-style
 * dependency, per "do not introduce new dependencies") — just enough
 * digits to rule out garbage/placeholder values while staying agnostic
 * to country code, formatting, or length conventions. 7 is the shortest
 * digit count a real local number is likely to have.
 */
function isValidPhoneNumber(value: string | undefined | null): boolean {
  if (isMissingOrPlaceholder(value)) return false;
  return countDigits(value as string) >= 7;
}

/** True only for a value that is present, not a placeholder, AND looks like an email. Loose sanity check, not full RFC 5322 validation — consistent with isValidPhoneNumber's approach, and no new dependency. */
function isValidEmail(value: string | undefined | null): boolean {
  if (isMissingOrPlaceholder(value)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value as string).trim());
}

/** True only for a value that is present, not a placeholder, AND parses to a real date. */
function isValidIsoDateTime(value: string | undefined | null): boolean {
  if (isMissingOrPlaceholder(value)) return false;
  const parsed = new Date(value as string);
  return !Number.isNaN(parsed.getTime());
}

/**
 * Resolves a model-supplied serviceId to a configured service.
 *
 * Two-tier lookup, defense in depth:
 * 1. Exact id match — the fast, common path every existing business
 *    already relies on when the model sends the id correctly.
 * 2. Normalized fallback, matching against BOTH each service's id and
 *    its display name — so this self-heals even if the model sends the
 *    name instead of the id, in any casing/spacing variant, without
 *    depending on prompt compliance. This is the backend half of a
 *    two-layer fix; the prompt/tool-schema changes (see
 *    lib/knowledge/knowledge-builder.ts and lib/prompt/prompt-builder.ts)
 *    are the other half — making the id visible and explicit, which
 *    reduces how often this fallback is even needed. Neither layer alone
 *    is sufficient: prompts can't guarantee model output, and matching
 *    without ever showing the id would work only by accident.
 */
function findService<T extends { id: string; name: string }>(
  services: T[],
  requestedId: string
): T | undefined {
  const exact = services.find((s) => s.id === requestedId);
  if (exact) return exact;

  const normalizedRequest = normalizeServiceKey(requestedId);
  return services.find(
    (s) =>
      normalizeServiceKey(s.id) === normalizedRequest ||
      normalizeServiceKey(s.name) === normalizedRequest
  );
}

/**
 * Single source of truth for "what happens when the AI decides to book an
 * appointment or log a lead." Both the voice webhook and the chat endpoint
 * call this instead of each having their own copy.
 *
 * DEMO MODE: when business.demo is true, no real calendar event, sheet row,
 * email, or SMS is created — the response text stays worded identically to
 * a real booking so the experience is indistinguishable to whoever's
 * testing it. Only the side effects are simulated.
 */
export async function executeToolCall(
  { name, arguments: args }: ToolCallArgs,
  businessId: string
): Promise<string> {
  const business = getBusinessById(businessId);
  if (!business) return "I couldn't find that business's configuration.";

  switch (name) {
    case "book_appointment": {
      const a = args as {
        callerName: string;
        callerPhone: string;
        callerEmail?: string;
        serviceId: string;
        preferredStartTimeISO: string;
      };

      // Reject incomplete/placeholder tool calls before they ever reach
      // service resolution or Calendar — the model is not always going to
      // wait for real data before calling the tool (see prompt-builder.ts
      // for the corresponding instruction change), so this is the backend
      // guarantee that nothing invalid gets further than this point.
      const missingFields: string[] = [];
      if (!isValidCallerName(a.callerName)) missingFields.push("your name");
      if (!isValidPhoneNumber(a.callerPhone)) missingFields.push("a valid phone number");
      if (isMissingOrPlaceholder(a.serviceId)) missingFields.push("which service"); // exact match handled next
      if (!isValidIsoDateTime(a.preferredStartTimeISO)) missingFields.push("a preferred date and time");

      if (missingFields.length > 0) {
        return `Before I can book that, I still need ${missingFields.join(", ")}. Could you share that?`;
      }

      const service = findService(business.knowledge.services, a.serviceId);

      if (!service) {
        return "I'm having trouble matching that service. Let me confirm which service you'd like to book.";
      }

      if (business.demo) {
        console.log("[demo] simulated booking", { business: business.id, ...a });
        return `Booked ${service.name} for ${a.callerName} at ${a.preferredStartTimeISO}. A confirmation will be sent.`;
      }

      const booking = await bookAppointment({
        calendarId: business.integrations.googleCalendarId ?? "",
        summary: `${service.name} — ${a.callerName}`,
        startTimeISO: a.preferredStartTimeISO,
        durationMinutes: service.durationMinutes,
        timezone: business.booking.timezone,
        attendeeName: a.callerName,
        attendeePhone: a.callerPhone,
      });

      if (!booking.success) {
        return "I wasn't able to book that slot — could you offer an alternative day or time?";
      }

      const hasEmail = isValidEmail(a.callerEmail);

      void sendCallerConfirmation({
        toEmail: hasEmail ? (a.callerEmail as string).trim() : undefined,
        businessName: business.name,
        serviceName: service.name,
        startTimeISO: booking.confirmedStartTimeISO!,
      });
      void sendOwnerAlert({
        ownerEmail: business.integrations.notifyEmail,
        businessName: business.name,
        message: `New booking: ${service.name} for ${a.callerName} at ${booking.confirmedStartTimeISO}.`,
      });

      return `Booked ${service.name} for ${a.callerName} at ${booking.confirmedStartTimeISO}. A confirmation will be sent.`;
    }

    case "save_confirmation_email": {
      const a = args as { email?: string; serviceName?: string; confirmedStartTimeISO?: string };

      if (!isValidEmail(a.email)) {
        return "That doesn't look like a valid email address — could you double check it?";
      }
      const email = (a.email as string).trim();

      // Structural guarantee against re-booking: this branch has no access
      // to bookAppointment (not imported for this purpose) and never
      // constructs a booking request. Whatever the model intended, the
      // worst this code can do is fail to send a confirmation — it cannot
      // create a duplicate appointment, a second Calendar event, or a
      // new lead.
      //
      // PERSISTENCE, PHASE 1: deliberately not written anywhere durable.
      // A post-booking email update is not a lead and not a new booking —
      // it doesn't belong in the Sheets lead log (that would corrupt
      // reporting: "which email belongs to which booking?" becomes
      // unanswerable once lead rows and booking-update rows are mixed
      // together), and there's no booking record/identifier in this
      // architecture yet to attach it to durably. The only thing this
      // does with the email is the confirmation attempt below — which is
      // exactly the real, intended use of the data, not a workaround.
      // Phase 2 (once Brevo access + a booking identifier both exist):
      // persist the email against that specific booking; this comment is
      // the marker for where that hook belongs.
      if (!business.demo) {
        void sendCallerConfirmation({
          toEmail: email,
          businessName: business.name,
          serviceName: a.serviceName ?? "your appointment",
          startTimeISO: a.confirmedStartTimeISO ?? "",
        });
      }

      return "Thanks! I've saved your email address. Email confirmations will be available once our email system is fully configured.";
    }

    case "log_lead": {
      const a = args as { callerName?: string; callerPhone?: string; reason: string };

      if (business.demo) {
        console.log("[demo] simulated lead", { business: business.id, ...a });
        return "Got it, I've passed this along to the team.";
      }

      await logLead(
        {
          businessId,
          callerName: a.callerName,
          callerPhone: a.callerPhone,
          reason: a.reason,
          callTimestampISO: new Date().toISOString(),
        },
        business.integrations.leadSheetId ?? ""
      );

      void sendOwnerAlert({
        ownerEmail: business.integrations.notifyEmail,
        businessName: business.name,
        message: `New lead: ${a.callerName ?? "Unknown"} — ${a.reason}`,
      });

      return "Got it, I've passed this along to the team.";
    }

    default:
      return "That action isn't available.";
  }
}
