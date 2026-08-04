import "server-only";

import { BusinessConfig } from "@/lib/config/business-schema";
import { BusinessKnowledge, KnowledgeSection, KnowledgeSectionId } from "@/types/knowledge";

/**
 * lib/knowledge/knowledge-builder.ts
 * ---------------------------------------------------------------------
 * Reads a loaded BusinessConfig and organizes it into named, normalized
 * knowledge sections with clean text ready to inject into the Prompt
 * Builder (lib/prompt/prompt-builder.ts) or any future consumer.
 *
 * This is a structured knowledge layer, not Retrieval-Augmented
 * Generation. On purpose, there is no:
 *   - PDF/document ingestion or file parsing
 *   - website scraping
 *   - embeddings or a vector database
 *   - search/similarity indexing
 * Every section here is deterministically derived from the one
 * BusinessConfig object already loaded for that business — there's
 * nothing to retrieve, because there's no corpus larger than the config
 * itself yet. A real Knowledge Base Engine (documented as Phase 4/7 in
 * docs/MASTER-GUIDE.md) is a different, later milestone.
 *
 * Avoiding duplicate information: two of the seven sections (pricing,
 * booking) are built here — normalized, available, and fully typed — but
 * deliberately NOT injected into today's system prompt by
 * buildSystemPrompt(), because doing so would repeat information the
 * prompt already conveys elsewhere (Services already includes price;
 * the "WHAT YOU CAN DO" instructions plus the book_appointment tool
 * definition already cover booking behavior). They're built anyway
 * because a future consumer — a quote widget, a dashboard preview,
 * an additional prompt section — shouldn't have to re-derive them from
 * raw config.
 *
 * Determinism: buildBusinessKnowledge always returns the same seven
 * sections in the same order for the same config, independent of the
 * config object's own key iteration order.
 * ---------------------------------------------------------------------
 */

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

function section(id: KnowledgeSectionId, label: string, text: string): KnowledgeSection {
  return { id, label, text, isEmpty: text.trim().length === 0 };
}

function buildCompanySection(config: BusinessConfig): KnowledgeSection {
  const lines = [`${config.name} — ${config.industry}`];
  if (config.contact.address) lines.push(`Address: ${config.contact.address}`);
  if (config.contact.website) lines.push(`Website: ${config.contact.website}`);
  if (config.contact.email) lines.push(`Email: ${config.contact.email}`);
  return section("company", "Company", lines.join("\n"));
}

function buildHoursSection(config: BusinessConfig): KnowledgeSection {
  const text = DAY_ORDER.map((day) => {
    const h = config.hours[day];
    const label = day[0].toUpperCase() + day.slice(1);
    return h.closed ? `${label}: Closed` : `${label}: ${h.open} – ${h.close}`;
  }).join("\n");
  return section("hours", "Business Hours", text);
}

function buildServicesSection(config: BusinessConfig): KnowledgeSection {
  const text = config.knowledge.services
    .map((s) => {
      const price = s.price ? ` (${s.price})` : "";
      return `- ${s.name}${price}, ~${s.durationMinutes} min — ${s.description} [serviceId: ${s.id}]`;
    })
    .join("\n");
  return section("services", "Services", text);
}

/**
 * Compact price list, distinct from the Services section's fuller
 * descriptions. See the file header for why this isn't injected into the
 * system prompt today.
 */
function buildPricingSection(config: BusinessConfig): KnowledgeSection {
  const priced = config.knowledge.services.filter((s) => Boolean(s.price));
  const text = priced.map((s) => `- ${s.name}: ${s.price}`).join("\n");
  return section("pricing", "Pricing", text);
}

function buildFaqsSection(config: BusinessConfig): KnowledgeSection {
  const text = config.knowledge.faqs
    .map((f) => `Q: ${f.question}\nA: ${f.answer}`)
    .join("\n\n");
  return section("faqs", "Frequently Asked Questions", text);
}

function buildPoliciesSection(config: BusinessConfig): KnowledgeSection {
  const p = config.knowledge.policies;
  const lines: string[] = [];
  if (p.emergency) lines.push(`Emergency: ${p.emergency}`);
  if (p.insurance) lines.push(`Insurance: ${p.insurance}`);
  if (p.cancellation) lines.push(`Cancellation: ${p.cancellation}`);
  if (p.general) lines.push(...p.general);
  return section("policies", "Policies", lines.join("\n"));
}

/**
 * Summarizes what can be booked. See the file header for why this isn't
 * injected into the system prompt today.
 */
function buildBookingSection(config: BusinessConfig): KnowledgeSection {
  if (!config.booking.enabled) return section("booking", "Booking", "");
  const names = config.booking.appointmentTypes.map(
    (id) => config.knowledge.services.find((s) => s.id === id)?.name ?? id
  );
  const text = names.length ? `Bookable: ${names.join(", ")}.` : "";
  return section("booking", "Booking", text);
}

/**
 * Builds the full structured knowledge view for a business. Pure function:
 * the same config always produces the same BusinessKnowledge.
 *
 * @example
 * ```ts
 * const knowledge = buildBusinessKnowledge(business);
 * const hours = getKnowledgeSection(knowledge, "hours");
 * console.log(hours?.text);
 * ```
 */
export function buildBusinessKnowledge(config: BusinessConfig): BusinessKnowledge {
  return {
    businessId: config.id,
    sections: [
      buildCompanySection(config),
      buildHoursSection(config),
      buildServicesSection(config),
      buildPricingSection(config),
      buildFaqsSection(config),
      buildPoliciesSection(config),
      buildBookingSection(config),
    ],
  };
}

/**
 * Looks up one section by id. Returns undefined only if the id is
 * somehow not one of the seven built by buildBusinessKnowledge (shouldn't
 * happen in normal use).
 *
 * @example
 * ```ts
 * const faqs = getKnowledgeSection(knowledge, "faqs");
 * if (faqs && !faqs.isEmpty) { ... }
 * ```
 */
export function getKnowledgeSection(
  knowledge: BusinessKnowledge,
  id: KnowledgeSectionId
): KnowledgeSection | undefined {
  return knowledge.sections.find((s) => s.id === id);
}
