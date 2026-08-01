import "server-only";

/**
 * lib/integrations/notify.ts
 * ---------------------------------------------------------------------
 * Brevo transactional email integration. Replaces the console.log stub —
 * AppointmentConfirmation, OwnerAlert, sendCallerConfirmation, and
 * sendOwnerAlert are all unchanged in their inputs, so
 * lib/tools/execute-tool-call.ts (the Tool Executor) required no changes
 * to call the real implementation. Return type moved from the stub's
 * `Promise<void>` to `Promise<NotifyResult>` — non-breaking, since the
 * Tool Executor calls both with `void sendX(...)` and never reads the
 * resolved value.
 *
 * No SDK — plain fetch against Brevo's REST API
 * (POST https://api.brevo.com/v3/smtp/email), consistent with this
 * project's other integrations (Calendar, Sheets).
 *
 * SMS is out of scope, same as the stub it replaces (see toPhone/
 * ownerPhone below) — Twilio is a separate, later integration.
 * ---------------------------------------------------------------------
 */

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const DEFAULT_SENDER_NAME = "AI X Systems";

// ---------------------------------------------------------------------------
// Public interface — unchanged from the stub this replaces, except the
// return type (Promise<void> -> Promise<NotifyResult>; see file header)
// ---------------------------------------------------------------------------

export interface AppointmentConfirmation {
  toEmail?: string;
  toPhone?: string;
  businessName: string;
  serviceName: string;
  startTimeISO: string;
}

export interface OwnerAlert {
  ownerEmail?: string;
  ownerPhone?: string;
  businessName: string;
  message: string;
}

export interface NotifyResult {
  success: boolean;
  error?: string;
}

/**
 * Sends the caller a booking confirmation email.
 *
 * KNOWN GAP, not introduced by this milestone: the Tool Executor's only
 * call site for this function never supplies `toEmail` (it only collects
 * the caller's name and phone during booking, not an email — see
 * lib/tools/execute-tool-call.ts). Since that file is off-limits this
 * milestone, this function can't invent a recipient — when `toEmail` is
 * missing, it returns `{ success: false, error }` without calling Brevo,
 * rather than silently pretending to send. In practice, caller
 * confirmation emails will not go out until the booking flow is extended
 * to collect an email address — a separate, future change.
 *
 * SMS (`toPhone`) is not implemented — Twilio integration is a distinct,
 * later milestone.
 *
 * Never throws. Every failure (missing recipient, missing config, Brevo
 * rejection, network error) comes back as `{ success: false, error }`,
 * with full detail logged server-side via console.error.
 *
 * @example
 * ```ts
 * const result = await sendCallerConfirmation({
 *   toEmail: "jane@example.com",
 *   businessName: "Smile Dental Clinic",
 *   serviceName: "Routine Cleaning",
 *   startTimeISO: "2026-08-05T14:00:00",
 * });
 * if (!result.success) console.error(result.error);
 * ```
 */
export async function sendCallerConfirmation(
  confirmation: AppointmentConfirmation
): Promise<NotifyResult> {
  if (!confirmation.toEmail) {
    return { success: false, error: "No recipient email available for this confirmation." };
  }

  const sender = getSender();
  if (!sender) {
    return { success: false, error: "Email notifications are not configured (missing sender address)." };
  }

  const businessName = escapeHtml(confirmation.businessName);
  const serviceName = escapeHtml(confirmation.serviceName);
  const when = confirmation.startTimeISO; // see file header: intentionally not reformatted, see docs

  return sendBrevoEmail(sender, {
    to: [{ email: confirmation.toEmail }],
    subject: `Your appointment with ${confirmation.businessName} is confirmed`,
    htmlContent: `<p>Hi,</p><p>Your <strong>${serviceName}</strong> appointment with <strong>${businessName}</strong> is confirmed for <strong>${escapeHtml(when)}</strong>.</p><p>If you need to reschedule, just reach back out.</p>`,
    textContent: `Your ${confirmation.serviceName} appointment with ${confirmation.businessName} is confirmed for ${when}.`,
  });
}

/**
 * Notifies the business owner of a new booking or lead.
 *
 * Never throws. Every failure (missing owner email, missing config, Brevo
 * rejection, network error) comes back as `{ success: false, error }`,
 * with full detail logged server-side via console.error.
 *
 * SMS (`ownerPhone`) is not implemented — Twilio integration is a
 * distinct, later milestone.
 *
 * @example
 * ```ts
 * const result = await sendOwnerAlert({
 *   ownerEmail: "owner@example.com",
 *   businessName: "Smile Dental Clinic",
 *   message: "New booking: Cleaning for Jane Doe at 2026-08-05T14:00:00.",
 * });
 * if (!result.success) console.error(result.error);
 * ```
 */
export async function sendOwnerAlert(alert: OwnerAlert): Promise<NotifyResult> {
  if (!alert.ownerEmail) {
    return { success: false, error: "No owner email configured for this business." };
  }

  const sender = getSender();
  if (!sender) {
    return { success: false, error: "Email notifications are not configured (missing sender address)." };
  }

  return sendBrevoEmail(sender, {
    to: [{ email: alert.ownerEmail }],
    subject: `${alert.businessName}: new activity from your AI receptionist`,
    htmlContent: `<p>${escapeHtml(alert.message)}</p>`,
    textContent: alert.message,
  });
}

// ---------------------------------------------------------------------------
// Internal: Brevo request construction and sending
// ---------------------------------------------------------------------------

interface SenderIdentity {
  email: string;
  name: string;
}

/**
 * The verified "from" address for all outgoing email, platform-wide — not
 * per-business. Neither AppointmentConfirmation nor OwnerAlert carries a
 * sender address (BusinessConfig does have `integrations.confirmationFromEmail`,
 * but it isn't threaded through to this function's inputs by the Tool
 * Executor, which is off-limits this milestone), so the sender is read
 * from environment variables instead: one verified Brevo sender for the
 * whole platform, with the specific business named in the email content.
 */
function getSender(): SenderIdentity | null {
  const email = process.env.BREVO_SENDER_EMAIL;
  if (!email) return null;
  return { email, name: process.env.BREVO_SENDER_NAME || DEFAULT_SENDER_NAME };
}

interface BrevoEmailRequest {
  to: Array<{ email: string; name?: string }>;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

async function sendBrevoEmail(
  sender: SenderIdentity,
  request: BrevoEmailRequest
): Promise<NotifyResult> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return { success: false, error: "Email notifications are not configured (missing Brevo API key)." };
  }

  try {
    const res = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender,
        to: request.to,
        subject: request.subject,
        htmlContent: request.htmlContent,
        textContent: request.textContent,
      }),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      console.error("[notify] Brevo request failed:", res.status, bodyText);
      return { success: false, error: "The email service rejected the notification." };
    }

    return { success: true };
  } catch (err) {
    console.error("[notify] unexpected error sending email:", err);
    return { success: false, error: "Something went wrong while sending the notification." };
  }
}

/** Minimal HTML escaping — these strings include caller-supplied and LLM-generated text. */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
