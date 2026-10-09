/**
 * Pure helpers — no I/O, no server-only import — so they can be unit
 * tested directly (see scripts/test-growth.mjs).
 */
import crypto from "crypto";
import type { GrowthSettings } from "./types";

// ── Email extraction ─────────────────────────────────────────────────────
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
const BAD_LOCAL = /^(no-?reply|do-?not-?reply|privacy|abuse|webmaster|postmaster|unsubscribe|mailer-daemon|sentry|wix|example)/i;
const BAD_DOMAIN = /(sentry|wixpress|example\.|domain\.com|yourdomain|email\.com|test\.com|godaddy|squarespace|shopify|wordpress|schema\.org|w3\.org)/i;
const IMAGE_TAIL = /\.(png|jpe?g|gif|svg|webp|css|js)$/i;
const ROLE_PREFERENCE = ["info", "contact", "hello", "office", "frontdesk", "reception", "appointments", "admin", "service", "support"];

function registrable(host: string): string {
  return host.toLowerCase().replace(/^www\./, "").split(".").slice(-2).join(".");
}

export function extractBestEmail(html: string, websiteUrl?: string): string | undefined {
  const text = html.replace(/&#64;|&commat;|\[at\]|\(at\)/gi, "@").replace(/%40/g, "@");
  const found = new Set<string>();
  for (const m of text.matchAll(EMAIL_RE)) {
    const e = m[0].toLowerCase().replace(/^[^a-z0-9]+/, "");
    const [local, domain] = e.split("@");
    if (!local || !domain || IMAGE_TAIL.test(e) || BAD_LOCAL.test(local) || BAD_DOMAIN.test(domain)) continue;
    found.add(e);
  }
  if (found.size === 0) return undefined;

  let siteDomain = "";
  try { siteDomain = registrable(new URL(websiteUrl ?? "").hostname); } catch { /* no site */ }

  const rank = (e: string) => {
    const [local, domain] = e.split("@");
    const sameSite = siteDomain && registrable(domain) === siteDomain ? 0 : 100;
    const role = ROLE_PREFERENCE.indexOf(local);
    return sameSite + (role === -1 ? 50 : role);
  };
  return [...found].sort((a, b) => rank(a) - rank(b))[0];
}

// ── Website signals ──────────────────────────────────────────────────────
export function detectSignals(html: string) {
  return {
    chatWidget: /intercom|drift\.com|tawk\.to|crisp\.chat|livechat|tidio|zopim|zendesk|hubspot.*conversations|podium|birdeye|smith\.ai|ruby\.com/i.test(html),
    onlineBooking: /calendly|acuityscheduling|zocdoc|book (an )?appointment online|schedule online|book online|simplybook|setmore|booksy|jobber|housecall/i.test(html),
  };
}

export function scoreLead(input: {
  reviewCount?: number; rating?: number; phone?: string; chatWidget?: boolean;
}): number {
  let s = 0;
  const r = input.reviewCount ?? 0;
  if (r >= 25) s += 15;
  if (r >= 75) s += 15;
  if (r >= 200) s += 10;
  if ((input.rating ?? 0) >= 4) s += 10;
  if (input.phone) s += 15;
  if (input.chatWidget === false) s += 15; // no chat today = clearest gap
  return s;
}

// ── SSRF guard for fetching arbitrary business websites ──────────────────
export function isSafePublicUrl(raw: string): URL | null {
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || !h.includes(".")) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return null;
  }
  if (h.includes(":") || h.startsWith("[")) return null;
  return u;
}

// ── Opener validation (LLM writes ONE line; everything else is fixed) ────
export function openerIsSafe(opener: string, allowedFacts: string[]): boolean {
  if (!opener || opener.length > 220 || opener.length < 20) return false;
  if (/https?:|www\.|@|!|\n/.test(opener)) return false;
  if (/[\u{1F300}-\u{1FAFF}]/u.test(opener)) return false;
  if (/(revenue|% |percent|guarantee|best|#1|award|famous|love what|amazing|incredible)/i.test(opener)) return false;
  const allowedDigits = new Set(allowedFacts.join(" ").match(/\d+/g) ?? []);
  for (const d of opener.match(/\d+/g) ?? []) if (!allowedDigits.has(d)) return false;
  return true;
}

// ── Email copy: fixed, honest templates ──────────────────────────────────
export interface CopyInput {
  businessName: string;
  industry?: string;
  city?: string;
  opener?: string;
  step: 1 | 2 | 3;
  senderName: string;
  demoUrl: string;
  /** private preview built for this business; when present the email leads with it */
  tryUrl?: string;
  offer: GrowthSettings["offer"];
}

export function buildEmail(i: CopyInput): { subject: string; body: string } {
  const what = i.offer === "voice"
    ? "an AI receptionist that answers your calls and website chat 24/7, answers common questions, and sends every new enquiry straight to you"
    : "an AI receptionist on your website that answers visitor questions 24/7, captures their details, and emails every new enquiry straight to you";
  const where = [i.industry, i.city].filter(Boolean).join(" in ");
  const opener = i.opener?.trim() || `I came across ${i.businessName}${where ? ` while looking at ${where}` : ""}.`;
  const sign = `— ${i.senderName}\nAI x Systems`;

  if (i.tryUrl) {
    const phone = i.offer === "voice" ? " (or on your phone line)" : "";
    if (i.step === 1) {
      return {
        subject: `A preview for ${i.businessName}`,
        body: `${opener}\n\nI run AI x Systems. I put together a working preview of an AI receptionist for ${i.businessName}, built only from what's public on your website. Try asking it something a customer would: ${i.tryUrl}\n\nIt answers questions 24/7, takes the visitor's details and sends every enquiry straight to you. It's only a preview. If it looks useful, reply and I'll show you how it would go live on your site${phone}.\n\n${sign}`,
      };
    }
    if (i.step === 2) {
      return {
        subject: `Re: A preview for ${i.businessName}`,
        body: `Following up in case my note got buried. The preview is still live: ${i.tryUrl}\n\nWorth a quick look? Reply and I'll set it up properly for ${i.businessName}.\n\n${sign}`,
      };
    }
  }

  if (i.step === 1) {
    return {
      subject: `After-hours enquiries at ${i.businessName}`,
      body: `${opener}\n\nI run AI x Systems. We install ${what}, so a visitor who shows up at 9pm doesn't leave for a competitor.\n\nWe're onboarding a small number of local businesses right now. If it's useful, I'll show you a 2-minute demo built around ${i.businessName}. Reply "demo" or pick a time here: ${i.demoUrl}\n\n${sign}`,
    };
  }
  if (i.step === 2) {
    return {
      subject: `Re: After-hours enquiries at ${i.businessName}`,
      body: `Following up on my note below, in case it got buried.\n\nThe short version: ${what}. There's a live example you can try in about 30 seconds here: ${i.demoUrl}\n\nWorth a quick look for ${i.businessName}? Reply "demo" and I'll set one up.\n\n${sign}`,
    };
  }
  return {
    subject: `Closing the loop, ${i.businessName}`,
    body: `I'll stop here so I don't clutter your inbox.\n\nIf handling after-hours enquiries ever becomes a priority, the demo stays open: ${i.demoUrl}\n\n${sign}`,
  };
}

export function footer(address: string, unsubscribeUrl: string): string {
  return `\n\n--\nAI x Systems · ${address}\nNot interested? Unsubscribe here: ${unsubscribeUrl}`;
}

// ── Signed unsubscribe links ─────────────────────────────────────────────
function secret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET || process.env.SESSION_SECRET;
  if (!s) throw new Error("UNSUBSCRIBE_SECRET or SESSION_SECRET must be set.");
  return s;
}
export function unsubscribeToken(leadId: string): string {
  return crypto.createHmac("sha256", secret()).update(`unsub:${leadId}`).digest("base64url");
}
export function verifyUnsubscribeToken(leadId: string, token: string): boolean {
  const a = Buffer.from(token); const b = Buffer.from(unsubscribeToken(leadId));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── Resend (svix) webhook signature verification ─────────────────────────
export function verifySvix(body: string, headers: { id?: string | null; timestamp?: string | null; signature?: string | null }, whsec: string): boolean {
  if (!headers.id || !headers.timestamp || !headers.signature) return false;
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const key = Buffer.from(whsec.replace(/^whsec_/, ""), "base64");
  const expected = crypto.createHmac("sha256", key).update(`${headers.id}.${headers.timestamp}.${body}`).digest("base64");
  return headers.signature.split(" ").some((part) => {
    const sig = part.split(",")[1];
    if (!sig) return false;
    const a = Buffer.from(sig); const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

export function firstEmailIn(text: string): string | undefined {
  return text.match(EMAIL_RE)?.[0]?.toLowerCase();
}
