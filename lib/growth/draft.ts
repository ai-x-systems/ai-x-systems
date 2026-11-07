import "server-only";
import { getChatCompletion } from "@/lib/llm/groq-client";
import { siteConfig } from "@/lib/site-config";
import { getSupabaseClient } from "@/lib/supabase/client";
import { createMessage, hasMessageForStep, listLeads, updateLead } from "./store";
import { buildEmail, openerIsSafe } from "./pure";
import { getStoredBusiness } from "@/lib/config/business-store";
import { chooseHook, hoursFacts, shortName, type LeakFacts } from "./copy";
import type { GrowthSettings, OutreachLead } from "./types";

/**
 * The model writes ONE short opening line from facts we give it. The rest
 * of the email is a fixed, honest template. That keeps every message
 * on-brand and makes it structurally impossible for the model to invent
 * claims, prices, results or fake familiarity. If the line fails
 * validation we silently use the plain fallback opener.
 */
async function writeOpener(lead: OutreachLead): Promise<string | undefined> {
  const facts = [lead.businessName, lead.industry, lead.city, lead.reviewCount ? String(lead.reviewCount) : ""].filter(Boolean) as string[];
  const result = await getChatCompletion({
    systemPrompt:
      "You write one opening sentence for a short, polite B2B email. Rules: one sentence, 12-25 words, plain and neutral, no flattery, no exclamation marks, no emojis, no links, no claims about revenue, quality or results. Use ONLY the facts provided. Do not invent anything. Output the sentence only.",
    messages: [{
      role: "user",
      content: `Business: ${lead.businessName}\nType: ${lead.industry ?? "local business"}\nCity: ${lead.city ?? "unknown"}\n${lead.reviewCount && lead.reviewCount >= 50 ? "It has a solid number of customer reviews online." : ""}\nWrite the sentence noting that I noticed their business and want to ask about how they handle enquiries outside opening hours.`,
    }],
    temperature: 0.3,
    maxTokens: 80,
  });
  if (!result.success) return undefined;
  const line = result.message.content.trim().replace(/^["']|["']$/g, "");
  return openerIsSafe(line, facts) ? line : undefined;
}

/** Everything we can honestly say about this business, from its own site and listing (and the preview built from that site). */
async function factsFor(lead: OutreachLead): Promise<LeakFacts> {
  let hours: ReturnType<typeof hoursFacts> = { hoursKnown: false };
  if (lead.demoBusinessId) {
    const preview = await getStoredBusiness(lead.demoBusinessId).catch(() => null);
    if (preview) hours = hoursFacts(preview.config.hours, preview.config.hoursKnown !== false);
  }
  return {
    ...hours,
    claims247: lead.signals.claims247 === true,
    phoneOnly: lead.signals.onlineBooking === false && lead.signals.chatWidget === false,
    noChat: lead.signals.chatWidget === false,
    reviewCount: lead.reviewCount,
    rating: lead.rating,
  };
}

/**
 * Throws away emails you have NOT sent yet and writes them again with the current copy.
 * Anything already sent, replied to, or in a follow-up stage is left alone.
 */
export async function redraftUnsent(settings: GrowthSettings): Promise<{ replaced: number; drafted: number }> {
  const leads = await listLeads({ stage: "drafted", limit: 100 });
  const db = getSupabaseClient();
  let replaced = 0;
  for (const lead of leads) {
    const { data } = await db.from("outreach_messages").delete().eq("lead_id", lead.id).eq("status", "draft").select("id");
    if (data?.length) { await updateLead(lead.id, { stage: "enriched" }); replaced++; }
  }
  const { drafted } = await draftBatch(settings, 100);
  return { replaced, drafted };
}

/** Drafts step-1 emails for enriched leads (best score first) and follow-ups for contacted leads that are due. */
export async function draftBatch(settings: GrowthSettings, limit = 15): Promise<{ drafted: number }> {
  const demoUrl = `${siteConfig.brand.baseUrl}${siteConfig.forms.demoPath}`;
  const auto = settings.sendMode === "auto" && settings.autoSend;
  const status = auto ? ("approved" as const) : ("draft" as const);
  let drafted = 0;

  const fresh = await listLeads({ stage: "enriched", limit });
  const base = siteConfig.brand.baseUrl.replace(/\/+$/, "");
  for (const lead of fresh) {
    if (!lead.email || (await hasMessageForStep(lead.id, 1))) continue;
    // Hold the email until the preview exists, or we have definitively given up on one.
    if (!lead.demoBusinessId && !lead.signals.demoSkipped) continue;
    const facts = await factsFor(lead);
    const generic = chooseHook(facts, { short: shortName(lead.businessName), offer: settings.offer }).key === "generic";
    const opener = generic ? await writeOpener(lead) : undefined;
    const { subject, body } = buildEmail({ businessName: lead.businessName, industry: lead.industry, city: lead.city, opener, facts, step: 1, senderName: settings.senderName, demoUrl, tryUrl: lead.demoBusinessId ? `${base}/try/${lead.demoBusinessId}` : undefined, offer: settings.offer });
    await createMessage({ leadId: lead.id, step: 1, subject, bodyText: body, status });
    await updateLead(lead.id, { stage: auto ? "queued" : "drafted" });
    drafted++;
  }

  const due = await listLeads({ stage: "contacted", dueBefore: new Date().toISOString(), limit });
  for (const lead of due) {
    const next = (lead.step + 1) as 2 | 3;
    if (next > 3 || !lead.email) { await updateLead(lead.id, { next_action_at: null }); continue; }
    if (await hasMessageForStep(lead.id, next)) continue;
    const { subject, body } = buildEmail({ businessName: lead.businessName, industry: lead.industry, city: lead.city, facts: await factsFor(lead), step: next, senderName: settings.senderName, demoUrl, tryUrl: lead.demoBusinessId ? `${base}/try/${lead.demoBusinessId}` : undefined, offer: settings.offer });
    await createMessage({ leadId: lead.id, step: next, subject, bodyText: body, status });
    await updateLead(lead.id, { next_action_at: null });
    drafted++;
  }
  return { drafted };
}
