import "server-only";
import nodemailer from "nodemailer";

/**
 * lib/integrations/notify.ts
 * ---------------------------------------------------------------------
 * Email notifications — TEMPORARILY sent via Gmail SMTP (nodemailer)
 * instead of Brevo, until a real domain + Brevo's IP-authorization issue
 * are sorted out. AppointmentConfirmation, OwnerAlert,
 * sendCallerConfirmation, sendOwnerAlert, and NotifyResult are all
 * UNCHANGED — every caller (lib/tools/execute-tool-call.ts) needed zero
 * changes. Only the internal sending mechanism was swapped, the same
 * "provider behind a stable interface" pattern already used for
 * voice/LLM providers elsewhere in this project.
 *
 * TO SWITCH BACK TO BREVO LATER: replace sendGmailEmail's internals with
 * the Brevo REST call (POST https://api.brevo.com/v3/smtp/email, header
 * "api-key"), keep everything else in this file the same. No other file
 * needs to change either way — that's the point of the swap being
 * internal to this one function.
 *
 * nodemailer is a deliberate, justified exception to this project's
 * "no new dependencies" pattern: unlike Brevo/Calendar (simple REST
 * calls, hand-rollable) or Groq (also REST), Gmail's send path is SMTP —
 * a stateful, multi-step protocol, not a single HTTP call — genuinely not
 * reasonable to hand-roll safely. nodemailer has zero dependencies of its
 * own (verified against its current npm listing), so this doesn't drag in
 * a dependency tree, just one well-maintained, single-purpose package.
 *
 * SMS is out of scope, same as before (see toPhone/ownerPhone below).
 * ---------------------------------------------------------------------
 */

const DEFAULT_SENDER_NAME = "AI X Systems";

// ---------------------------------------------------------------------------
// Public interface — fully unchanged from the Brevo version
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
 * KNOWN GAP, unrelated to this change: the Tool Executor's default
 * book_appointment call site doesn't always have `toEmail` available (see
 * lib/tools/execute-tool-call.ts) — when missing, this returns
 * `{ success: false, error }` without attempting to send.
 *
 * Never throws. Every failure comes back as `{ success: false, error }`,
 * with full detail logged server-side via console.error.
 */
export async function sendCallerConfirmation(
  confirmation: AppointmentConfirmation
): Promise<NotifyResult> {
  if (!confirmation.toEmail) {
    return { success: false, error: "No recipient email available for this confirmation." };
  }

  const sender = getSender();
  if (!sender) {
    return { success: false, error: "Email notifications are not configured (missing Gmail credentials)." };
  }

  const businessName = escapeHtml(confirmation.businessName);
  const serviceName = escapeHtml(confirmation.serviceName);
  const when = confirmation.startTimeISO; // intentionally not reformatted, see docs

  return sendGmailEmail(sender, {
    to: confirmation.toEmail,
    subject: `Your appointment with ${confirmation.businessName} is confirmed`,
    html: `<p>Hi,</p><p>Your <strong>${serviceName}</strong> appointment with <strong>${businessName}</strong> is confirmed for <strong>${escapeHtml(when)}</strong>.</p><p>If you need to reschedule, just reach back out.</p>`,
    text: `Your ${confirmation.serviceName} appointment with ${confirmation.businessName} is confirmed for ${when}.`,
  });
}

/**
 * Notifies the business owner of a new booking or lead.
 *
 * Never throws. Every failure comes back as `{ success: false, error }`,
 * with full detail logged server-side via console.error.
 */
export async function sendOwnerAlert(alert: OwnerAlert): Promise<NotifyResult> {
  if (!alert.ownerEmail) {
    return { success: false, error: "No owner email configured for this business." };
  }

  const sender = getSender();
  if (!sender) {
    return { success: false, error: "Email notifications are not configured (missing Gmail credentials)." };
  }

  return sendGmailEmail(sender, {
    to: alert.ownerEmail,
    subject: `${alert.businessName}: new activity from your AI receptionist`,
    html: `<p>${escapeHtml(alert.message)}</p>`,
    text: alert.message,
  });
}

// ---------------------------------------------------------------------------
// Internal: Gmail SMTP transport, via nodemailer
// ---------------------------------------------------------------------------

interface SenderIdentity {
  email: string;
  name: string;
}

/**
 * The single Gmail account used to send all outgoing email, platform-wide
 * — not per-business, same limitation as the Brevo version had. Read from
 * env vars: GMAIL_USER (the sending account) and GMAIL_APP_PASSWORD (a
 * Gmail App Password, NOT the account's real password — Gmail rejects
 * plain-password SMTP login entirely). See docs/ACCOUNTS.md for setup.
 */
function getSender(): SenderIdentity | null {
  const email = process.env.GMAIL_USER;
  if (!email) return null;
  return { email, name: process.env.GMAIL_SENDER_NAME || DEFAULT_SENDER_NAME };
}

// Reused across invocations within a warm server instance — creating a new
// transporter per email would work too, but this avoids repeated setup cost.
let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }
  return cachedTransporter;
}

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

async function sendGmailEmail(sender: SenderIdentity, request: EmailRequest): Promise<NotifyResult> {
  const transporter = getTransporter();
  if (!transporter) {
    return { success: false, error: "Email notifications are not configured (missing Gmail App Password)." };
  }

  try {
    await transporter.sendMail({
      from: `"${sender.name}" <${sender.email}>`,
      to: request.to,
      subject: request.subject,
      html: request.html,
      text: request.text,
    });
    return { success: true };
  } catch (err) {
    console.error("[notify] Gmail send failed:", err);
    return { success: false, error: "The email service rejected the notification." };
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
