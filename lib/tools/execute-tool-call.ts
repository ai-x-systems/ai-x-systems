import { getBusinessById } from "@/config/businesses";
import { bookAppointment } from "@/lib/integrations/calendar";
import { logLead } from "@/lib/integrations/sheets";
import { sendCallerConfirmation, sendOwnerAlert } from "@/lib/integrations/notify";

export interface ToolCallArgs {
  name: string;
  arguments: Record<string, unknown>;
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
        serviceId: string;
        preferredStartTimeISO: string;
      };

      // TEMPORARY DEBUG LOGGING — remove after diagnosing the tool-call-loop issue.
      console.log("[BOOK APPOINTMENT INPUT]", {
        callerName: a.callerName,
        callerPhone: a.callerPhone,
        serviceId: a.serviceId,
        preferredStartTimeISO: a.preferredStartTimeISO,
      });
      console.log(
        "[AVAILABLE SERVICES]",
        business.knowledge.services.map((s) => ({ id: s.id, name: s.name }))
      );

      const service = business.knowledge.services.find((s) => s.id === a.serviceId);

      // TEMPORARY DEBUG LOGGING — remove after diagnosing the tool-call-loop issue.
      console.log("[MATCHED SERVICE]", service);

      if (!service) {
        return `That service isn't recognized. Available: ${business.knowledge.services
          .map((s) => s.name)
          .join(", ")}.`;
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

      // TEMPORARY DEBUG LOGGING — remove after diagnosing the tool-call-loop issue.
      console.log("[BOOKING RESULT]", {
        success: booking.success,
        error: booking.error,
        eventId: booking.eventId,
        confirmedStartTimeISO: booking.confirmedStartTimeISO,
      });

      if (!booking.success) {
        return "I wasn't able to book that slot — could you offer an alternative day or time?";
      }

      void sendCallerConfirmation({
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
