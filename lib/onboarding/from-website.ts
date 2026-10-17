import "server-only";
import { getChatCompletion } from "@/lib/llm/groq-client";
import { isSafePublicUrl } from "@/lib/growth/pure";
import { discoverLinks, extractBrandColor, extractHoursFromText, extractJsonLdFacts, extractMeta, pickRelevantText, type LdFacts } from "./site-facts";

export interface WebsiteDraft {
  name?: string; industry?: string; phone?: string; address?: string; contactEmail?: string;
  hoursText?: string; servicesText?: string; faqsText?: string; policiesText?: string;
  /** the colour the site uses for its brand, "#rrggbb" */
  brandColor?: string;
}

export interface DraftDiagnostics {
  pagesRead: number;
  chars: number;
  structuredData: boolean;
  hoursFound: boolean;
  servicesFound: boolean;
  faqsFound: boolean;
}

/** Human-readable summary shown to the admin when a preview can't be built. */
export function describeDiagnostics(d: DraftDiagnostics): string {
  const found = [d.hoursFound && "opening hours", d.servicesFound && "services", d.faqsFound && "FAQs"].filter(Boolean).join(", ") || "none of: hours, services, FAQs";
  return `Read ${d.pagesRead} page${d.pagesRead === 1 ? "" : "s"} (${d.chars.toLocaleString()} characters). Found: ${found}.`;
}

async function fetchHtml(url: string): Promise<string> {
  const safe = isSafePublicUrl(url);
  if (!safe) return "";
  try {
    const res = await fetch(safe.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AIxSystemsBot/1.0)", Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(6500),
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return "";
    if (!isSafePublicUrl(res.url)) return ""; // a redirect into a private address
    return (await res.text()).slice(0, 600_000);
  } catch {
    return "";
  }
}

async function fetchCss(url: string): Promise<string> {
  const safe = isSafePublicUrl(url);
  if (!safe) return "";
  try {
    const res = await fetch(safe.toString(), { headers: { "User-Agent": "Mozilla/5.0 (compatible; AIxSystemsBot/1.0)", Accept: "text/css,*/*" }, redirect: "follow", signal: AbortSignal.timeout(5000) });
    if (!res.ok || !isSafePublicUrl(res.url)) return "";
    return (await res.text()).slice(0, 250_000);
  } catch {
    return "";
  }
}

/** Up to two stylesheet addresses linked from the page (where a site's brand colour usually lives). */
function stylesheetLinks(html: string, origin: string): string[] {
  const out: string[] = [];
  for (const tag of html.matchAll(/<link\b[^>]*>/gi)) {
    if (!/rel=["'][^"']*stylesheet/i.test(tag[0])) continue;
    const href = tag[0].match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    try { out.push(new URL(href, origin).toString()); } catch { /* skip bad url */ }
    if (out.length >= 2) break;
  }
  return out;
}

function toText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>|<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&ndash;|&#8211;/g, "-").replace(/&mdash;|&#8212;/g, "-")
    .replace(/\s+/g, " ").trim();
}

function mergeLd(all: LdFacts[]): LdFacts {
  const out: LdFacts = { hoursLines: [], services: [] };
  for (const f of all) {
    out.name ??= f.name; out.phone ??= f.phone; out.email ??= f.email; out.address ??= f.address; out.description ??= f.description;
    if (!out.hoursLines.length) out.hoursLines = f.hoursLines;
    out.services = [...new Set([...out.services, ...f.services])].slice(0, 25);
  }
  return out;
}

/**
 * Drafts the onboarding form from the client's public site. Reads the home
 * page plus the contact/about/services/FAQ pages it links to, trusts the
 * site's own structured data and explicit "Mon-Fri 9-5" text for opening
 * hours (never the AI), and uses the AI only to organise services, FAQs and
 * policies. The result is a DRAFT for a human to check.
 */
export async function draftFromWebsite(rawUrl: string): Promise<{ draft?: WebsiteDraft; diagnostics?: DraftDiagnostics; error?: string }> {
  const safe = isSafePublicUrl(rawUrl);
  if (!safe) return { error: "Enter a valid public website address." };
  const origin = safe.origin;

  const home = await fetchHtml(safe.toString());
  if (!home) return { error: "Couldn't open that website. It may be down, or it blocks automated visits. Use the boxes below to enter their details yourself." };

  const extra = [...new Set([
    ...discoverLinks(home, origin, 5),
    ...["/contact", "/contact-us", "/about", "/about-us", "/services", "/faq", "/hours"].map((p) => `${origin}${p}`),
  ])].filter((u) => u.replace(/\/$/, "") !== safe.toString().replace(/\/$/, "")).slice(0, 8);
  const [rest, cssTexts] = await Promise.all([Promise.all(extra.map(fetchHtml)), Promise.all(stylesheetLinks(home, origin).map(fetchCss))]);
  const pages = [home, ...rest.filter(Boolean)];

  const ld = mergeLd(pages.map(extractJsonLdFacts));
  const meta = extractMeta(home);
  const text = pages.map(toText).join(" \n--- ");
  const diagnostics: DraftDiagnostics = {
    pagesRead: pages.length, chars: text.length, structuredData: !!(ld.name || ld.hoursLines.length || ld.services.length),
    hoursFound: false, servicesFound: false, faqsFound: false,
  };

  if (text.length < 300 && !diagnostics.structuredData) {
    return { error: "That website shows almost no text to automated readers (it is probably built with JavaScript only). Use the boxes below to enter their hours and services yourself.", diagnostics };
  }

  // Opening hours: the site's own structured data first, then explicit hours text. Never guessed.
  const hoursLines = ld.hoursLines.length ? ld.hoursLines : extractHoursFromText(text);

  const evidence = [
    meta.title && `PAGE TITLE: ${meta.title}`,
    meta.description && `PAGE DESCRIPTION: ${meta.description}`,
    ld.name && `NAME (structured data): ${ld.name}`,
    ld.phone && `PHONE (structured data): ${ld.phone}`,
    ld.address && `ADDRESS (structured data): ${ld.address}`,
    ld.services.length && `SERVICES (structured data): ${ld.services.join("; ")}`,
    `PAGE TEXT:\n${pickRelevantText(text, 9000)}`,
  ].filter(Boolean).join("\n");

  const result = await getChatCompletion({
    systemPrompt:
      'You extract business facts from website text into JSON. Use ONLY what the text states. If a value is not clearly stated, use an empty string. NEVER guess or invent prices, phone numbers or policies. Output a single JSON object, no markdown, with exactly these string keys: name, industry, phone, address, contactEmail, servicesText, faqsText, policiesText. industry: a short label such as "HVAC contractor" or "dentist". servicesText: one service per line as "Name | price | minutes | short description" (leave price and minutes empty if unknown); include the main services the business says it offers. faqsText: one per line as "Question | Answer", only if the site clearly answers it. policiesText: one short policy per line (cancellation, insurance, emergencies, service area) only if stated.',
    messages: [{ role: "user", content: evidence }],
    temperature: 0,
    maxTokens: 1500,
  });

  let obj: Record<string, unknown> = {};
  if (result.success) {
    const raw = result.message.content.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    try { obj = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as Record<string, unknown>; } catch { /* use structured data only */ }
  } else if (!hoursLines.length && !ld.services.length) {
    return { error: "The AI drafting service is busy. Try again in a minute, or enter their details yourself.", diagnostics };
  }

  const s = (k: string) => (typeof obj[k] === "string" ? (obj[k] as string).trim().slice(0, 4000) : undefined) || undefined;
  const servicesText = s("servicesText") ?? (ld.services.length ? ld.services.join("\n") : undefined);
  const draft: WebsiteDraft = {
    name: s("name") ?? ld.name, industry: s("industry"), phone: s("phone") ?? ld.phone, address: s("address") ?? ld.address,
    contactEmail: s("contactEmail") ?? ld.email,
    hoursText: hoursLines.length ? hoursLines.join("\n") : undefined,
    servicesText, faqsText: s("faqsText"), policiesText: s("policiesText"),
    brandColor: extractBrandColor(home, cssTexts.filter(Boolean)),
  };
  diagnostics.hoursFound = !!draft.hoursText;
  diagnostics.servicesFound = !!draft.servicesText;
  diagnostics.faqsFound = !!draft.faqsText;
  return { draft, diagnostics };
}
