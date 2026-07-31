/**
 * types/knowledge.ts
 * ---------------------------------------------------------------------
 * A BusinessKnowledge is not a data source — it's a normalized, ready-to-
 * render *view* over a BusinessConfig (lib/config/business-schema.ts),
 * built by lib/knowledge/knowledge-builder.ts. It organizes what's already
 * in the config into named sections so consumers (the Prompt Builder
 * today; potentially other consumers later) can get exactly the knowledge
 * they need without re-deriving formatting logic themselves.
 *
 * NOT RAG: no retrieval, no embeddings, no search. Every section is
 * deterministically derived from the one config object already loaded for
 * that business — see lib/knowledge/knowledge-builder.ts for the full
 * explanation of what's deliberately out of scope for this milestone.
 * ---------------------------------------------------------------------
 */

export type KnowledgeSectionId =
  | "company"
  | "hours"
  | "services"
  | "pricing"
  | "faqs"
  | "policies"
  | "booking";

export interface KnowledgeSection {
  id: KnowledgeSectionId;
  /** Human-readable heading, e.g. "Business Hours". */
  label: string;
  /**
   * Clean, ready-to-inject text for this section. Empty string when there
   * was no underlying data for it — check `isEmpty` rather than
   * `text.length` yourself, since it's the intent-carrying flag.
   */
  text: string;
  /** True when the business config had nothing to say for this section. */
  isEmpty: boolean;
}

export interface BusinessKnowledge {
  businessId: string;
  /**
   * Always all seven sections, always in this fixed order: company,
   * hours, services, pricing, faqs, policies, booking. Order is
   * deterministic regardless of the business config's own key order, so
   * any consumer iterating `sections` gets consistent output every time.
   */
  sections: KnowledgeSection[];
}
