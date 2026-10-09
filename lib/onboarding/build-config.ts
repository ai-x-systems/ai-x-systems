import { BusinessConfigSchema, type BusinessConfig } from "../config/business-schema";

/**
 * Pure (no I/O) so it can be unit tested. Turns the flat onboarding form
 * into a full, schema-valid BusinessConfig with safe defaults:
 *   - booking OFF (leads only) — the safe default; turn on per client later
 *   - Sheets / Calendar unset — leads go to the dashboard, email and webhook
 *   - demo false (a real client)
 */

export interface OnboardInput {
  name: string;
  industry: string;
  website?: string;
  timezone?: string;
  phone?: string;
  address?: string;
  contactEmail?: string;
  notifyEmail: string;
  assistantName?: string;
  tone?: "friendly" | "professional" | "warm" | "concise";
  hoursText?: string;
  servicesText?: string;
  faqsText?: string;
  policiesText?: string;
  webhookUrl?: string;
  leadSheetId?: string;
  /** true = a preview business: no alerts, no sheet, no billing. */
  demo?: boolean;
}

export function slugify(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "client";
}

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const DAY_ALIASES: Record<string, number> = { mon: 0, tue: 1, tues: 1, wed: 2, thu: 3, thur: 3, thurs: 3, fri: 4, sat: 5, sun: 6 };

function to24(h: string, m: string | undefined, ap: string | undefined, fallbackAp?: string): string {
  let hour = Number(h);
  const min = m ? Number(m) : 0;
  const mer = (ap || fallbackAp || "").toLowerCase();
  if (mer === "pm" && hour < 12) hour += 12;
  if (mer === "am" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/**
 * Accepts one line per rule, e.g.
 *   Mon-Fri 9am-5pm
 *   Sat 10:00-14:00
 *   Sun closed
 * Anything not mentioned is treated as closed. Empty input = Mon–Fri 9–5.
 */
export function parseHours(text: string | undefined): BusinessConfig["hours"] {
  const closed = { open: "", close: "", closed: true as boolean | undefined };
  const out: Record<string, { open: string; close: string; closed?: boolean }> = {};
  for (const d of DAYS) out[d] = { ...closed };

  const lines = (text ?? "").split(/\n|;/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    for (const d of DAYS.slice(0, 5)) out[d] = { open: "09:00", close: "17:00" };
    return out as BusinessConfig["hours"];
  }

  for (const line of lines) {
    const dayMatch = line.match(/^([a-z]{3,9})(?:\s*[-–to]+\s*([a-z]{3,9}))?/i);
    if (!dayMatch) continue;
    const start = DAY_ALIASES[dayMatch[1].slice(0, 3).toLowerCase()];
    const end = dayMatch[2] ? DAY_ALIASES[dayMatch[2].slice(0, 3).toLowerCase()] : start;
    if (start === undefined || end === undefined) continue;

    const rest = line.slice(dayMatch[0].length);
    const isClosed = /closed/i.test(rest);
    const t = rest.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (!isClosed && !t) continue;

    for (let i = start; i <= (end >= start ? end : 6); i++) {
      if (isClosed) { out[DAYS[i]] = { ...closed }; continue; }
      const open = to24(t![1], t![2], t![3], t![6]);
      let close = to24(t![4], t![5], t![6], t![3]);
      // "9-5" with no am/pm anywhere: a close hour at or before the open hour means pm.
      if (!t![3] && !t![6] && Number(t![4]) <= Number(t![1]) && Number(t![4]) < 12) close = to24(String(Number(t![4]) + 12), t![5], undefined);
      out[DAYS[i]] = { open, close };
    }
  }
  return out as BusinessConfig["hours"];
}

/** One service per line: "Name | price | minutes | description" (all after the name optional). */
export function parseServices(text: string | undefined): BusinessConfig["knowledge"]["services"] {
  const used = new Set<string>();
  return (text ?? "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 40).map((line) => {
    const [name, price, minutes, ...desc] = line.split("|").map((p) => p.trim());
    let id = slugify(name); let n = 2;
    while (used.has(id)) id = `${slugify(name)}-${n++}`;
    used.add(id);
    return {
      id,
      name: name.slice(0, 120),
      description: (desc.join(" | ") || name).slice(0, 400),
      durationMinutes: Number(minutes) > 0 ? Number(minutes) : 30,
      ...(price ? { price: price.slice(0, 60) } : {}),
    };
  });
}

/** One FAQ per line: "Question | Answer". */
export function parseFaqs(text: string | undefined): Array<{ question: string; answer: string }> {
  return (text ?? "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 60).flatMap((line) => {
    const i = line.indexOf("|");
    if (i < 1) return [];
    const question = line.slice(0, i).trim(); const answer = line.slice(i + 1).trim();
    return question && answer ? [{ question: question.slice(0, 300), answer: answer.slice(0, 1000) }] : [];
  });
}

export function buildBusinessConfig(input: OnboardInput, id: string): BusinessConfig {
  const timezone = input.timezone?.trim() || "America/Chicago";
  const assistantName = input.assistantName?.trim() || "Ava";
  const general = (input.policiesText ?? "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 30);
  const webhookUrl = input.webhookUrl?.trim() || undefined;

  const config = {
    id,
    name: input.name.trim().slice(0, 120),
    industry: input.industry.trim().slice(0, 120) || "Local business",
    phoneNumber: input.phone?.trim() || "",
    timezone,
    demo: input.demo === true,
    contact: {
      ...(input.address?.trim() ? { address: input.address.trim() } : {}),
      ...(input.website?.trim() ? { website: input.website.trim() } : {}),
      email: (input.contactEmail || input.notifyEmail).trim(),
    },
    client: { id, name: input.name.trim(), status: input.demo ? "demo" : "onboarding", deploymentType: input.demo ? "demo_preview" : "client_deployment" },
    hours: parseHours(input.hoursText),
    knowledge: {
      services: parseServices(input.servicesText),
      faqs: parseFaqs(input.faqsText),
      policies: general.length ? { general } : {},
    },
    voice: {
      assistantName,
      tone: input.tone ?? "friendly",
      language: "en-US",
      greeting: `Thanks for contacting ${input.name.trim()}, this is ${assistantName} — how can I help you today?`,
    },
    booking: { enabled: false, appointmentTypes: [], bufferMinutes: 10, timezone },
    integrations: {
      notifyEmail: input.notifyEmail.trim(),
      ...(input.leadSheetId?.trim() ? { leadSheetId: input.leadSheetId.trim() } : {}),
      ...(webhookUrl ? { webhookUrl } : {}),
    },
  };

  return BusinessConfigSchema.parse(config);
}

export function generatePassword(): string {
  // 16 chars, no ambiguous characters; crypto-random.
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

// ── Previews (auto-demo) ────────────────────────────────────────────────
export type Services = "chat" | "voice" | "both";
export const isServices = (v: unknown): v is Services => v === "chat" || v === "voice" || v === "both";

/**
 * A preview is only worth showing a prospect if we found their opening
 * hours AND at least a service or an FAQ. Without hours the assistant
 * would have to invent them, and a wrong answer in front of the owner
 * loses the sale.
 */
export function demoDraftIsUsable(d?: { hoursText?: string; servicesText?: string; faqsText?: string } | null): boolean {
  if (!d?.hoursText?.trim()) return false;
  return !!(d.servicesText?.trim() || d.faqsText?.trim());
}

export function demoId(name: string, rand: string): string {
  return `demo-${slugify(name).slice(0, 24).replace(/-+$/g, "")}-${rand}`;
}
export const isDemoId = (id: string) => id.startsWith("demo-");

export function buildDemoConfig(
  input: OnboardInput & { demo?: never },
  id: string
): BusinessConfig {
  const base = buildBusinessConfig({ ...input, demo: true }, id);
  const policies = [
    "This is a preview built only from the business's public website. Details may be incomplete.",
    "Prices are not listed in this preview: if asked, say the team will confirm pricing and offer to take the visitor's details.",
    ...(base.knowledge.policies?.general ?? []),
  ];
  return BusinessConfigSchema.parse({
    ...base,
    knowledge: {
      ...base.knowledge,
      // AI-extracted prices were never reviewed by a human: never show them.
      services: base.knowledge.services.map((svc) => {
        const rest = { ...svc } as Record<string, unknown>;
        delete rest.price;
        return rest;
      }),
      policies: { ...(base.knowledge.policies ?? {}), general: policies },
    },
  });
}
