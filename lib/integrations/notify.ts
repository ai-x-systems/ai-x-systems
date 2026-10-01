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
 * TO SWITCH BACK TO BREVO LATER: replace deliverEmail's internals with
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

  return deliverEmail(sender, {
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

  return deliverEmail(sender, {
    to: alert.ownerEmail,
    subject: `${alert.businessName}: new activity from your AI receptionist`,
    html: `<p>${escapeHtml(alert.message)}</p>`,
    text: alert.message,
  });
}

/**
 * Sends a password reset link. Shares the same Gmail sender/transport as
 * the other two notification functions in this file.
 *
 * Never throws. Every failure comes back as `{ success: false, error }`.
 */
export async function sendPasswordResetEmail(
  toEmail: string,
  resetUrl: string
): Promise<NotifyResult> {
  const sender = getSender();
  if (!sender) {
    return { success: false, error: "Email notifications are not configured (missing Gmail credentials)." };
  }

  return deliverEmail(sender, {
    to: toEmail,
    subject: "Reset your AI x Systems password",
    html: `<p>Someone requested a password reset for this account.</p><p><a href="${resetUrl}">Click here to set a new password</a>. This link expires in 1 hour.</p><p>If you didn't request this, you can safely ignore this email.</p>`,
    text: `Reset your password: ${resetUrl} (expires in 1 hour). If you didn't request this, ignore this email.`,
  });
}

/**
 * Sends a one-off test email to confirm GMAIL_USER/GMAIL_APP_PASSWORD are
 * actually working, without needing to trigger a real booking/lead/reset
 * to find out. Used by the admin "Test email delivery" button.
 */
export async function sendTestEmail(toEmail: string): Promise<NotifyResult> {
  const sender = getSender();
  if (!sender) {
    return { success: false, error: "GMAIL_USER is not set." };
  }

  return deliverEmail(sender, {
    to: toEmail,
    subject: "AI x Systems — test email",
    html: `<p>This is a test email from your AI x Systems admin dashboard, sent at ${new Date().toISOString()}. If you received this, email delivery is working.</p>`,
    text: `This is a test email from your AI x Systems admin dashboard, sent at ${new Date().toISOString()}. If you received this, email delivery is working.`,
  });
}

/**
 * Pings the founder the moment a prospect submits the /demo form — speed
 * to lead is the single biggest conversion lever, and previously nothing
 * told anyone a submission had arrived.
 */
export async function sendEmailTo(to: string, subject: string, lines: string[]): Promise<NotifyResult> {
  const sender = getSender();
  if (!sender) return { success: false, error: "Email is not configured." };
  return deliverEmail(sender, {
    to,
    subject,
    html: lines.map((l) => `<p>${escapeHtml(l)}</p>`).join(""),
    text: lines.join("\n"),
  });
}

export async function sendFounderAlert(subject: string, lines: string[]): Promise<NotifyResult> {
  const to = process.env.FOUNDER_NOTIFY_EMAIL;
  if (!to) return { success: false, error: "FOUNDER_NOTIFY_EMAIL is not set." };
  return sendEmailTo(to, subject, lines);
}

/** Instant, honest acknowledgement to a prospect who just asked for a demo. */
export async function sendProspectAutoReply(input: {
  toEmail: string;
  contactName: string;
  businessName: string;
  tryUrl: string;
}): Promise<NotifyResult> {
  const sender = getSender();
  if (!sender) return { success: false, error: "Email is not configured." };
  const name = input.contactName.split(" ")[0] || "there";
  return deliverEmail(sender, {
    to: input.toEmail,
    subject: `We got your request, ${name}`,
    html: `<p>Hi ${escapeHtml(name)},</p><p>Thanks for asking about an AI receptionist for <strong>${escapeHtml(input.businessName)}</strong>. We read every request personally and will reply within one business day with next steps.</p><p>While you wait, you can try the live assistant here: <a href="${input.tryUrl}">${input.tryUrl}</a></p><p>— The AI x Systems team</p>`,
    text: `Hi ${name},\n\nThanks for asking about an AI receptionist for ${input.businessName}. We read every request personally and will reply within one business day with next steps.\n\nWhile you wait, try the live assistant: ${input.tryUrl}\n\n— The AI x Systems team`,
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
  const resendFrom = process.env.RESEND_API_KEY && process.env.RESEND_FROM;
  if (resendFrom) {
    const m = process.env.RESEND_FROM!.match(/^(.*)<(.+)>$/);
    return m
      ? { name: m[1].trim().replace(/^"|"$/g, "") || DEFAULT_SENDER_NAME, email: m[2].trim() }
      : { name: DEFAULT_SENDER_NAME, email: process.env.RESEND_FROM! };
  }
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
      // Without these, a stalled SMTP handshake hangs until the platform
      // kills the function. Fail fast and let the caller log it.
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
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

async function deliverEmail(sender: SenderIdentity, request: EmailRequest): Promise<NotifyResult> {
  // Preferred path: Resend's HTTP API — one stateless request, no SMTP
  // handshake, which is what makes it reliable from serverless.
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${sender.name} <${sender.email}>`,
          to: [request.to],
          subject: request.subject,
          html: request.html,
          text: request.text,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) return { success: true };
      console.error("[notify] Resend rejected email:", res.status, await res.text().catch(() => ""));
      // fall through to Gmail if it is configured
    } catch (err) {
      console.error("[notify] Resend request failed:", err);
    }
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return { success: false, error: "The email service rejected the notification." };
    }
  }

  const transporter = getTransporter();
  if (!transporter) {
    return { success: false, error: "Email notifications are not configured (set RESEND_API_KEY + RESEND_FROM, or GMAIL_USER + GMAIL_APP_PASSWORD)." };
  }

  try {
    const fromEmail = process.env.GMAIL_USER || sender.email;
    await transporter.sendMail({
      from: `"${sender.name}" <${fromEmail}>`,
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
