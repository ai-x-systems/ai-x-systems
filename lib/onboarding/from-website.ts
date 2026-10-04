import "server-only";
import { getChatCompletion } from "@/lib/llm/groq-client";
import { isSafePublicUrl } from "@/lib/growth/pure";

export interface WebsiteDraft {
  name?: string; industry?: string; phone?: string; address?: string; contactEmail?: string;
  hoursText?: string; servicesText?: string; faqsText?: string; policiesText?: string;
}

async function fetchPage(url: string): Promise<string> {
  const safe = isSafePublicUrl(url);
  if (!safe) return "";
  try {
    const res = await fetch(safe.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AIxSystemsBot/1.0)", Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok || !isSafePublicUrl(res.url)) return "";
    const html = (await res.text()).slice(0, 500_000);
    return html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
      .replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

/**
 * Drafts the onboarding form from the client's public site. The result is
 * ONLY a draft shown to the admin for review — the model is told never to
 * guess, but prices and hours must still be checked by a human before the
 * assistant is allowed to quote them to customers.
 */
export async function draftFromWebsite(rawUrl: string): Promise<{ draft?: WebsiteDraft; error?: string }> {
  const safe = isSafePublicUrl(rawUrl);
  if (!safe) return { error: "Enter a valid public website address." };
  const origin = safe.origin;

  const pages = await Promise.all([safe.toString(), `${origin}/about`, `${origin}/services`, `${origin}/contact`, `${origin}/faq`].map(fetchPage));
  const text = [...new Set(pages.filter(Boolean))].join("\n---\n").slice(0, 14000);
  if (text.length < 200) return { error: "Couldn't read enough text from that site (it may be built with JavaScript only). Fill the form manually." };

  const result = await getChatCompletion({
    systemPrompt:
      'You extract business facts from website text into JSON. Use ONLY what the text states. If a value is not clearly stated, use an empty string. NEVER guess or invent prices, hours, phone numbers or policies. Output a single JSON object, no markdown, with exactly these string keys: name, industry, phone, address, contactEmail, hoursText, servicesText, faqsText, policiesText. hoursText: one line per rule like "Mon-Fri 9am-5pm". servicesText: one service per line as "Name | price | minutes | short description" (leave price/minutes empty if unknown). faqsText: one per line as "Question | Answer", only if the site clearly answers it. policiesText: one short policy per line (cancellation, insurance, emergencies) only if stated.',
    messages: [{ role: "user", content: text }],
    temperature: 0,
    maxTokens: 1500,
  });
  if (!result.success) return { error: "The AI drafting service is busy. Try again in a minute, or fill the form manually." };

  const raw = result.message.content.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const obj = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as Record<string, unknown>;
    const s = (k: string) => (typeof obj[k] === "string" ? (obj[k] as string).trim().slice(0, 4000) : undefined) || undefined;
    return { draft: { name: s("name"), industry: s("industry"), phone: s("phone"), address: s("address"), contactEmail: s("contactEmail"), hoursText: s("hoursText"), servicesText: s("servicesText"), faqsText: s("faqsText"), policiesText: s("policiesText") } };
  } catch {
    return { error: "Couldn't read the AI's draft. Try again or fill the form manually." };
  }
}
