import "server-only";
import { siteConfig } from "@/lib/site-config";
import { firstSentAt, getLead, isSuppressed, listMessages, sentSince, updateLead, updateMessage } from "./store";
import { footer, unsubscribeToken } from "./pure";
import type { GrowthSettings } from "./types";

export interface Readiness {
  ok: boolean;
  checks: Array<{ label: string; ok: boolean; hint: string }>;
}

/** Everything that must be true before a single cold email may leave. Shown on the dashboard. */
export function growthReadiness(): Readiness {
  const replyTo = process.env.GROWTH_REPLY_TO ?? "";
  const from = process.env.GROWTH_FROM ?? "";
  const checks = [
    { label: "Resend API key", ok: !!process.env.RESEND_API_KEY, hint: "RESEND_API_KEY — cold email is only sent via Resend, never Gmail SMTP." },
    { label: "Sending identity", ok: /<.+@.+>|@/.test(from) && !/@(gmail|yahoo|outlook|hotmail)\./i.test(from), hint: "GROWTH_FROM on a verified SUBDOMAIN of your own domain (e.g. mail.aixsystems.app), not a free-mail address." },
    { label: "Reply-To is not a personal inbox", ok: !!replyTo && !/@(gmail|yahoo|outlook|hotmail)\./i.test(replyTo), hint: "GROWTH_REPLY_TO must be a domain address (e.g. hello@aixsystems.app) forwarded to you, so your personal Gmail never reaches prospects." },
    { label: "Physical mailing address", ok: (process.env.GROWTH_PHYSICAL_ADDRESS ?? "").trim().length > 8, hint: "GROWTH_PHYSICAL_ADDRESS — legally required in every commercial email (CAN-SPAM). A PO box or virtual mailbox is fine." },
    { label: "Real domain (not *.vercel.app)", ok: !/vercel\.app/.test(siteConfig.brand.baseUrl), hint: "Unsubscribe and demo links must point at your real domain. Connect aixsystems.app first." },
    { label: "Bounce/complaint webhook", ok: !!process.env.RESEND_WEBHOOK_SECRET, hint: "RESEND_WEBHOOK_SECRET — without it, bounces and spam complaints never stop future sends." },
    { label: "Google Places key", ok: !!process.env.GOOGLE_PLACES_API_KEY, hint: "GOOGLE_PLACES_API_KEY — needed for automatic lead discovery." },
  ];
  return { ok: checks.every((c) => c.ok), checks };
}

/** New sending domains must warm up: start tiny and grow, capped by the setting. */
async function allowedToday(settings: GrowthSettings): Promise<number> {
  const first = await firstSentAt();
  const days = first ? Math.floor((Date.now() - new Date(first).getTime()) / 86_400_000) : 0;
  const ceiling = Math.min(settings.dailySendCap, 5 + days * 3);
  const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
  return Math.max(0, ceiling - (await sentSince(startOfDay.toISOString())));
}

const DAY = 86_400_000;

export async function sendApproved(settings: GrowthSettings): Promise<{ sent: number; failed: number; blocked?: string }> {
  const readiness = growthReadiness();
  if (!readiness.ok) {
    const first = readiness.checks.find((c) => !c.ok)!;
    return { sent: 0, failed: 0, blocked: `${first.label}: ${first.hint}` };
  }

  let budget = await allowedToday(settings);
  if (budget === 0) return { sent: 0, failed: 0, blocked: "Daily/warm-up limit reached" };

  const approved = await listMessages("approved", budget);
  let sent = 0, failed = 0;

  for (const msg of approved) {
    const lead = msg.lead ?? (await getLead(msg.leadId));
    if (!lead?.email || ["replied", "demo_booked", "won", "lost", "unsubscribed", "bounced"].includes(lead.stage) || (await isSuppressed(lead.email))) {
      await updateMessage(msg.id, { status: "skipped" });
      continue;
    }

    const unsubUrl = `${siteConfig.brand.baseUrl}/unsubscribe?l=${lead.id}&t=${unsubscribeToken(lead.id)}`;
    const replyTo = process.env.GROWTH_REPLY_TO!;
    const text = msg.bodyText + footer(process.env.GROWTH_PHYSICAL_ADDRESS!, unsubUrl);

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.GROWTH_FROM,
          to: [lead.email],
          reply_to: replyTo,
          subject: msg.subject,
          text,
          headers: {
            "List-Unsubscribe": `<${unsubUrl}>, <mailto:${replyTo}?subject=unsubscribe>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          tags: [{ name: "lead_id", value: lead.id }],
        }),
        signal: AbortSignal.timeout(10000),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? `Resend ${res.status}`);

      await updateMessage(msg.id, { status: "sent", sent_at: new Date().toISOString(), provider_id: json.id ?? null, error: null });
      const gap = msg.step === 1 ? 3 * DAY : msg.step === 2 ? 4 * DAY : 0;
      await updateLead(lead.id, {
        stage: "contacted",
        step: msg.step,
        last_contacted_at: new Date().toISOString(),
        next_action_at: gap ? new Date(Date.now() + gap).toISOString() : null,
      });
      sent++;
    } catch (err) {
      failed++;
      await updateMessage(msg.id, { status: "failed", error: err instanceof Error ? err.message.slice(0, 300) : "send failed" });
    }
    if (--budget <= 0) break;
  }
  return { sent, failed };
}
