import "server-only";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { BusinessConfig } from "@/lib/config/business-schema";
import { mergeChat, type ChatSettings } from "@/lib/config/chat-settings";

/**
 * lib/config/overrides.ts
 * ---------------------------------------------------------------------
 * data/businesses/<id>.json (via config/businesses/index.ts) stays the
 * source of truth for structural config — booking rules, integrations
 * wiring, demo flag, services list. Those still require editing the JSON
 * file on GitHub, on purpose: they interact with tool definitions and
 * booking enforcement in lib/tools/execute-tool-call.ts, and a wrong edit
 * there can break booking outright.
 *
 * This file is deliberately scoped to the two lowest-risk, most-often-
 * requested edits: FAQs and the notification email. An override, when
 * present, replaces the corresponding field(s) from the JSON config —
 * applyOverride() only touches faqs/notifyEmail and returns everything
 * else from the base config untouched.
 *
 * getBusinessById() (config/businesses/index.ts) stays synchronous and
 * override-free on purpose — the file loader has no async story and many
 * callers (admin page, dashboard page) don't need overrides applied.
 * Only the chat route calls getEffectiveBusinessConfig() to merge them in
 * for what the AI actually sees.
 * ---------------------------------------------------------------------
 */

export interface BusinessOverride {
  faqs?: { question: string; answer: string }[];
  notifyEmail?: string;
  /** How the chat looks and sounds (colour, headline, greeting...). Needs the `chat` column on business_overrides. */
  chat?: ChatSettings;
}

export async function getBusinessOverride(businessId: string): Promise<BusinessOverride | null> {
  const supabase = getSupabaseClient();
  let { data, error } = await supabase
    .from("business_overrides")
    .select("faqs, notify_email, chat")
    .eq("business_id", businessId)
    .maybeSingle();

  // The `chat` column arrives with a database update. Until it exists, keep FAQs and the
  // notification email working instead of failing the whole lookup.
  if (error && (error.code === "42703" || error.code === "PGRST204" || /chat/.test(error.message ?? ""))) {
    const retry = await supabase.from("business_overrides").select("faqs, notify_email").eq("business_id", businessId).maybeSingle();
    data = retry.data ? { ...retry.data, chat: null } : null;
    error = retry.error;
  }

  if (error) {
    console.error("[overrides] failed to read:", error);
    return null;
  }
  if (!data) return null;

  return {
    faqs: data.faqs ?? undefined,
    notifyEmail: data.notify_email ?? undefined,
    chat: data.chat ?? undefined,
  };
}

export async function saveBusinessOverride(
  businessId: string,
  override: BusinessOverride
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("business_overrides").upsert({
    business_id: businessId,
    faqs: override.faqs ?? null,
    notify_email: override.notifyEmail ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** Saves only the chat appearance, leaving FAQs and the notification email untouched. */
export async function saveChatOverride(businessId: string, chat: ChatSettings): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("business_overrides").upsert({
    business_id: businessId,
    chat,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    const missing = error.code === "42703" || error.code === "PGRST204" || /chat/.test(error.message ?? "");
    console.error("[overrides] failed to save chat settings:", error);
    return { ok: false, error: missing ? "Appearance settings need a one-time database update (see docs)." : "Could not save. Please try again." };
  }
  return { ok: true };
}

/** Merges an override onto a base config. Only faqs/notifyEmail can change; everything else is the base config, untouched. */
export function applyOverride(base: BusinessConfig, override: BusinessOverride | null): BusinessConfig {
  if (!override) return base;

  return {
    ...base,
    chat: mergeChat(base.chat, override.chat),
    knowledge: {
      ...base.knowledge,
      faqs: override.faqs ?? base.knowledge.faqs,
    },
    integrations: {
      ...base.integrations,
      notifyEmail: override.notifyEmail ?? base.integrations.notifyEmail,
    },
  };
}

/** Convenience for the chat route: loads and applies a business's override in one call. */
export async function getEffectiveBusinessConfig(base: BusinessConfig): Promise<BusinessConfig> {
  const override = await getBusinessOverride(base.id);
  return applyOverride(base, override);
}
