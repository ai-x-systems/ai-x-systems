import { getBusinessById } from "@/config/businesses";
import { bookAppointment } from "@/lib/integrations/calendar";
import { logLead } from "@/lib/integrations/sheets";
import { sendCallerConfirmation, sendOwnerAlert } from "@/lib/integrations/notify";
import { sendToConfiguredWebhooks } from "@/lib/integrations/webhook";
import { recordActivity } from "@/lib/activity/log";
import { getEffectiveBusinessConfig } from "@/lib/config/overrides";

export interface ToolCallArgs {
  name: string;
  arguments: Record<string, unknown>;
}

function normalizeServiceKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
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
 *    depending on prompt compliance.
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
 * True for genuinely missing data: undefined/null, empty/whitespace-only,
 * or a common placeholder a model will sometimes supply for a required
 * field it doesn't actually have a value for yet, rather than omitting
 * the field.
 */
const PLACEHOLDER_VALUES = new Set(["unknown", "n/a", "none", "null"]);

function isMissingOrPlaceholder(value: string | undefined | null): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  if (PLACEHOLDER_VALUES.has(trimmed.toLowerCase())) return true;
  return false;
}

function isValidCallerName(value: string | undefined | null): boolean {
  if (isMissingOrPlaceholder(value)) return false;
  return (value as string).trim().length >= 2;
}

function countDigits(value: string): number {
  return (value.match(/\d/g) ?? []).length;
}

function isValidPhoneNumber(value: string | undefined | null): boolean {
  if (isMissingOrPlaceholder(value)) return false;
  return countDigits(value as string) >= 7;
}

/** True only for a value that is present, not a placeholder, AND looks like an email. Loose sanity check, no new dependency. */
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
  const effectiveBusiness = await getEffectiveBusinessConfig(business);

  switch (name) {
    case "book_appointment": {
      if (!business.booking.enabled) {
        return "We're not currently booking appointments directly — I can pass your details along to the team instead, or you're welcome to reach out directly.";
      }

      const a = args as {
        callerName?: string | null;
        callerPhone?: string | null;
        serviceId?: string | null;
        preferredStartTimeISO?: string | null;
        callerEmail?: string | null;
      };

      // Reject incomplete/placeholder tool calls before they ever reach
      // service resolution or Calendar.
      const missingFields: string[] = [];
      if (!isValidCallerName(a.callerName)) missingFields.push("your name");
      if (!isValidPhoneNumber(a.callerPhone)) missingFields.push("a valid phone number");
      if (isMissingOrPlaceholder(a.serviceId)) missingFields.push("which service"); // exact match handled next
      if (!isValidIsoDateTime(a.preferredStartTimeISO)) missingFields.push("a preferred date and time");

      if (missingFields.length > 0) {
        return `Before I can book that, I still need ${missingFields.join(", ")}. Could you share that?`;
      }
      // Validated non-empty/non-null above — narrow to plain strings so
      // downstream calls (bookAppointment, etc.) get the types they expect.
      const callerName = a.callerName as string;
      const callerPhone = a.callerPhone as string;
      const preferredStartTimeISO = a.preferredStartTimeISO as string;

      const service = findService(business.knowledge.services, a.serviceId as string);

      if (!service) {
        return "I'm having trouble matching that service. Let me confirm which service you'd like to book.";
      }

      // Even with booking "enabled", only services explicitly listed in
      // booking.appointmentTypes are actually schedulable. This is what
      // makes an empty (or partial) appointmentTypes list a real,
      // enforced "nothing bookable" state that doesn't depend on the
      // `enabled` flag's value — e.g. a non-appointment product/service
      // existing in `knowledge.services` can never be booked as if it
      // were a real time slot just because it resolves via findService.
      if (!business.booking.appointmentTypes.includes(service.id)) {
        return "That's not something we book as an appointment right now — I can pass your details along to the team instead.";
      }

      if (business.demo) {
        console.log("[demo] simulated booking", { business: business.id, ...a });
        void recordActivity(businessId, "booking", {
          serviceName: service.name,
          callerName,
          startTimeISO: preferredStartTimeISO,
          demo: true,
        });
        return `Booked ${service.name} for ${callerName} at ${preferredStartTimeISO}. A confirmation will be sent.`;
      }

      const booking = await bookAppointment({
        calendarId: business.integrations.googleCalendarId ?? "",
        summary: `${service.name} — ${callerName}`,
        startTimeISO: preferredStartTimeISO,
        durationMinutes: service.durationMinutes,
        timezone: business.booking.timezone,
        attendeeName: callerName,
        attendeePhone: callerPhone,
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
        ownerEmail: effectiveBusiness.integrations.notifyEmail,
        businessName: business.name,
        message: `New booking: ${service.name} for ${callerName} at ${booking.confirmedStartTimeISO}.`,
      });
      void sendToConfiguredWebhooks(business, {
        event: "booking",
        businessId: business.id,
        timestampISO: new Date().toISOString(),
        data: {
          serviceId: service.id,
          serviceName: service.name,
          callerName,
          callerPhone,
          startTimeISO: booking.confirmedStartTimeISO,
        },
      });
      void recordActivity(businessId, "booking", {
        serviceName: service.name,
        callerName,
        startTimeISO: booking.confirmedStartTimeISO,
      });

      return `Booked ${service.name} for ${callerName} at ${booking.confirmedStartTimeISO}. A confirmation will be sent.`;
    }

    case "save_confirmation_email": {
      const a = args as { email?: string | null; serviceName?: string | null; confirmedStartTimeISO?: string | null };

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
      const a = args as {
        callerName?: string | null;
        callerPhone?: string | null;
        callerEmail?: string | null;
        reason?: string | null;
      };

      // Same "tool schema no longer enforces required fields, so this is
      // the only real validation" reasoning as book_appointment above —
      // now that log_lead's parameters have no "required" array either, a
      // premature/empty call must be caught here, not silently logged as
      // a blank lead.
      if (isMissingOrPlaceholder(a.reason)) {
        return "Sure — what's the best reason to note for the team, and what name should I put with it?";
      }
      const reason = a.reason as string;

      if (business.demo) {
        console.log("[demo] simulated lead", { business: business.id, ...a });
        void recordActivity(businessId, "lead", {
          callerName: a.callerName,
          reason,
          demo: true,
        });
        return "Got it, I've passed this along to the team.";
      }

      const leadTimestampISO = new Date().toISOString();

      await logLead(
        {
          businessId,
          callerName: a.callerName ?? undefined,
          callerPhone: a.callerPhone ?? undefined,
          callerEmail: a.callerEmail ?? undefined,
          reason,
          callTimestampISO: leadTimestampISO,
        },
        business.integrations.leadSheetId ?? "",
        business.integrations.leadSheetTabName
      );
      
      void sendOwnerAlert({
        ownerEmail: effectiveBusiness.integrations.notifyEmail,
        businessName: business.name,
        message: `New lead: ${a.callerName ?? "Unknown"} — ${reason}`,
      });
      void sendToConfiguredWebhooks(business, {
        event: "lead",
        businessId: business.id,
        timestampISO: leadTimestampISO,
        data: { callerName: a.callerName, callerPhone: a.callerPhone, callerEmail: a.callerEmail, reason },
      });
      void recordActivity(businessId, "lead", {
        callerName: a.callerName,
        reason,
      });

      return "Got it, I've passed this along to the team.";
    }

    default:
      return "That action isn't available.";
  }
}
