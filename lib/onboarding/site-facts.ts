/**
 * Pure helpers (no I/O) that pull business facts out of a website's HTML.
 * Order of trust: structured data the site publishes for search engines
 * (JSON-LD) > explicit "Mon-Fri 9-5" style text > the AI's reading of the page.
 * Hours are never left to the AI when the site states them in a form we can read.
 */

const DAY3 = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const LONG_TO_IDX: Record<string, number> = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6 };
const SHORT2_TO_IDX: Record<string, number> = { mo: 0, tu: 1, we: 2, th: 3, fr: 4, sa: 5, su: 6 };

const fixClose = (t: string) => (t.startsWith("24:") ? "23:59" : t);
const hhmm = (t: string) => {
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  return m ? fixClose(`${m[1].padStart(2, "0")}:${m[2]}`) : undefined;
};

/** Compresses [(dayIdx, "08:00-17:00"), ...] into lines like "Mon-Fri 08:00-17:00". */
export function compressDayRanges(entries: Array<{ day: number; range: string }>): string[] {
  const byRange = new Map<string, number[]>();
  for (const e of entries) byRange.set(e.range, [...(byRange.get(e.range) ?? []), e.day]);
  const lines: Array<{ first: number; text: string }> = [];
  for (const [range, daysRaw] of byRange) {
    const days = [...new Set(daysRaw)].sort((a, b) => a - b);
    let i = 0;
    while (i < days.length) {
      let j = i;
      while (j + 1 < days.length && days[j + 1] === days[j] + 1) j++;
      const label = j > i ? `${DAY3[days[i]]}-${DAY3[days[j]]}` : DAY3[days[i]];
      const times = range === "00:00-23:59" ? "24 hours" : range;
      lines.push({ first: days[i], text: `${label} ${times}` });
      i = j + 1;
    }
  }
  return lines.sort((a, b) => a.first - b.first).map((l) => l.text);
}

// ── JSON-LD ─────────────────────────────────────────────────────────────
export interface LdFacts {
  name?: string; phone?: string; email?: string; address?: string; description?: string;
  hoursLines: string[]; services: string[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : undefined) || undefined;

function dayIdx(v: unknown): number | undefined {
  if (typeof v !== "string") return undefined;
  const last = v.split("/").pop()!.toLowerCase();
  return LONG_TO_IDX[last];
}

/** Handles schema.org openingHours strings: "Mo-Fr 09:00-17:00", "Mo,Tu 08:00-12:00", "Sa 10:00-14:00". */
export function parseSchemaOpeningHours(value: string): Array<{ day: number; range: string }> {
  const out: Array<{ day: number; range: string }> = [];
  const m = value.trim().match(/^([A-Za-z,\- ]+?)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
  if (!m) return out;
  const open = hhmm(m[2]), close = hhmm(m[3]);
  if (!open || !close) return out;
  const range = `${open}-${close}`;
  for (const part of m[1].split(",").map((p) => p.trim()).filter(Boolean)) {
    const [a, b] = part.split("-").map((p) => p.trim().toLowerCase().slice(0, 2));
    const s = SHORT2_TO_IDX[a], e = b !== undefined ? SHORT2_TO_IDX[b] : s;
    if (s === undefined || e === undefined) continue;
    for (let d = s; ; d = (d + 1) % 7) { out.push({ day: d, range }); if (d === e) break; if (out.length > 30) break; }
  }
  return out;
}

export function extractJsonLdFacts(html: string): LdFacts {
  const facts: LdFacts = { hoursLines: [], services: [] };
  const entries: Array<{ day: number; range: string }> = [];
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];

  const visit = (node: unknown, depth = 0) => {
    if (depth > 6) return;
    if (Array.isArray(node)) { node.forEach((n) => visit(n, depth + 1)); return; }
    if (!isObj(node)) return;
    if (Array.isArray(node["@graph"])) visit(node["@graph"], depth + 1);

    const spec = node.openingHoursSpecification;
    for (const s of Array.isArray(spec) ? spec : spec ? [spec] : []) {
      if (!isObj(s)) continue;
      const open = typeof s.opens === "string" ? hhmm(s.opens) : undefined;
      const close = typeof s.closes === "string" ? hhmm(s.closes) : undefined;
      if (!open || !close) continue;
      const days = Array.isArray(s.dayOfWeek) ? s.dayOfWeek : [s.dayOfWeek];
      for (const d of days) { const i = dayIdx(d); if (i !== undefined) entries.push({ day: i, range: `${open}-${close}` }); }
    }
    const oh = node.openingHours;
    for (const v of Array.isArray(oh) ? oh : oh ? [oh] : []) if (typeof v === "string") entries.push(...parseSchemaOpeningHours(v));

    facts.name ??= str(node.name);
    facts.phone ??= str(node.telephone);
    facts.email ??= str(node.email);
    if (!facts.description && str(node.description)) facts.description = str(node.description)!.slice(0, 500);
    const addr = node.address;
    if (!facts.address && isObj(addr)) {
      const a = [str(addr.streetAddress), str(addr.addressLocality), str(addr.addressRegion), str(addr.postalCode)].filter(Boolean).join(", ");
      if (a) facts.address = a;
    } else if (!facts.address && str(addr)) facts.address = str(addr);

    for (const offer of Array.isArray(node.makesOffer) ? node.makesOffer : []) {
      const n = isObj(offer) && isObj(offer.itemOffered) ? str(offer.itemOffered.name) : undefined;
      if (n) facts.services.push(n);
    }
    const cat = node.hasOfferCatalog;
    if (isObj(cat)) for (const it of Array.isArray(cat.itemListElement) ? cat.itemListElement : []) {
      if (isObj(it)) { const n = str(it.name) ?? (isObj(it.itemOffered) ? str(it.itemOffered.name) : undefined); if (n) facts.services.push(n); visit(it.itemListElement, depth + 1); }
    }
    for (const v of Object.values(node)) if (isObj(v) || Array.isArray(v)) visit(v, depth + 1);
  };

  for (const b of blocks) {
    try { visit(JSON.parse(b[1].trim())); } catch { /* malformed block: skip it */ }
  }
  facts.hoursLines = compressDayRanges(entries);
  facts.services = [...new Set(facts.services)].slice(0, 25);
  return facts;
}

// ── hours written as plain text ─────────────────────────────────────────
const DAY_WORD = "(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\\.?";
const TIME = "\\d{1,2}(?::\\d{2})?\\s*(?:a\\.?m\\.?|p\\.?m\\.?)?";
const HOURS_RE = new RegExp(
  `(${DAY_WORD}(?:\\s*(?:-|–|—|to|through|thru)\\s*${DAY_WORD})?)\\s*[:\\-–—]?\\s*(${TIME}\\s*(?:-|–|—|to)\\s*${TIME})`,
  "gi"
);

const dayShort = (w: string) => w.replace(/\./g, "").slice(0, 3).replace(/^./, (c) => c.toUpperCase()).replace(/^(.)(.*)$/, (_m, a, b) => a + b.toLowerCase());
const cleanTimes = (t: string) => t.replace(/a\.?m\.?/gi, "am").replace(/p\.?m\.?/gi, "pm").replace(/\s*(?:–|—|to)\s*/gi, "-").replace(/\s+/g, "");

/** Finds lines like "Monday 8:00 AM - 5:00 PM" or "Mon-Fri: 9am to 6pm" (and "open 24 hours") in visible page text. */
export function extractHoursFromText(text: string): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(HOURS_RE)) {
    const days = m[1].split(/\s*(?:-|–|—|to|through|thru)\s*/i).map(dayShort).join("-");
    const line = `${days} ${cleanTimes(m[2])}`;
    // Must contain a real day and a plausible clock time (rejects "Mon 2-3 items").
    if (!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/.test(line)) continue;
    if (!/\d{1,2}(:\d{2})?(am|pm)|\d{1,2}:\d{2}/i.test(cleanTimes(m[2]))) continue;
    if (!seen.has(line)) { seen.add(line); lines.push(line); }
    if (lines.length >= 7) break;
  }
  if (lines.length === 0 && /\b(open\s+)?24\s*(hours|hrs)\b|\b24\s*\/\s*7\b/i.test(text)) lines.push("Open 24 hours");
  return lines;
}

// ── choosing what the AI gets to read ───────────────────────────────────
const KEYWORDS = /(hours|open|monday|tuesday|wednesday|thursday|friday|saturday|sunday|24\s*\/\s*7|emergency|services?|we (offer|provide|specialize)|faq|call us|appointment|schedule|insurance|cancel|warranty|financing|free estimate|licensed)/gi;

/** First part of the page plus windows around the words that matter, so navigation menus can't crowd out the hours and services. */
export function pickRelevantText(text: string, max = 9000): string {
  const head = text.slice(0, 2500);
  const windows: Array<[number, number]> = [];
  for (const m of text.matchAll(KEYWORDS)) {
    const i = m.index ?? 0;
    if (i < 2500) continue;
    const a = Math.max(2500, i - 250), b = Math.min(text.length, i + 450);
    const last = windows[windows.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b); else windows.push([a, b]);
  }
  let out = head;
  for (const [a, b] of windows) {
    if (out.length >= max) break;
    out += " … " + text.slice(a, b);
  }
  return out.slice(0, max);
}

const LINK_KEYWORDS = /(contact|about|service|faq|hours|location|schedule|appointment|repair|install|maintenance|emergency|visit|our-)/i;
const SKIP_EXT = /\.(pdf|jpe?g|png|gif|svg|webp|zip|docx?|xlsx?|mp4|css|js)(\?|$)/i;

/** Same-site links worth reading (contact, services, FAQ...). Never leaves the site's own host. */
export function discoverLinks(html: string, origin: string, max = 5): string[] {
  let host: string;
  try { host = new URL(origin).hostname.replace(/^www\./, ""); } catch { return []; }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<a\s[^>]*href=["']([^"']+)["']/gi)) {
    let u: URL;
    try { u = new URL(m[1], origin); } catch { continue; }
    if (u.protocol !== "http:" && u.protocol !== "https:") continue;
    if (u.hostname.replace(/^www\./, "") !== host) continue;
    if (SKIP_EXT.test(u.pathname) || u.pathname === "/") continue;
    if (!LINK_KEYWORDS.test(u.pathname)) continue;
    u.hash = ""; u.search = "";
    const key = u.toString().replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key); out.push(u.toString());
    if (out.length >= max) break;
  }
  return out;
}

/** <title> and meta description: a cheap, reliable summary of what the business is. */
export function extractMeta(html: string): { title?: string; description?: string } {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim();
  const d = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i) ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']description["']/i);
  return { title: title?.slice(0, 200), description: d?.[1]?.trim().slice(0, 400) };
}
