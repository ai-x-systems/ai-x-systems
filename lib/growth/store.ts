import "server-only";
import { getSupabaseClient } from "@/lib/supabase/client";
import { DEFAULT_SETTINGS, type GrowthSettings, type OutreachLead, type OutreachMessage, type Stage, type MessageStatus } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
const toLead = (r: any): OutreachLead => ({
  id: r.id, placeId: r.place_id ?? undefined, businessName: r.business_name,
  industry: r.industry ?? undefined, city: r.city ?? undefined, country: r.country ?? undefined,
  website: r.website ?? undefined, phone: r.phone ?? undefined, email: r.email ?? undefined,
  rating: r.rating != null ? Number(r.rating) : undefined, reviewCount: r.review_count ?? undefined,
  signals: r.signals ?? {}, score: r.score ?? 0, stage: r.stage, step: r.step ?? 0,
  demoBusinessId: r.demo_business_id ?? undefined,
  nextActionAtISO: r.next_action_at ?? undefined, lastContactedAtISO: r.last_contacted_at ?? undefined,
  notes: r.notes ?? undefined, createdAtISO: r.created_at,
});
const toMsg = (r: any): OutreachMessage => ({
  id: r.id, leadId: r.lead_id, step: r.step, subject: r.subject, bodyText: r.body_text,
  status: r.status, sentAtISO: r.sent_at ?? undefined, error: r.error ?? undefined, createdAtISO: r.created_at,
});

const db = () => getSupabaseClient();

// ── settings ────────────────────────────────────────────────────────────
export async function getSettings(): Promise<GrowthSettings> {
  const { data } = await db().from("growth_settings").select("value").eq("key", "main").maybeSingle();
  return { ...DEFAULT_SETTINGS, ...(data?.value ?? {}) };
}
export async function saveSettings(s: GrowthSettings): Promise<void> {
  const { error } = await db().from("growth_settings").upsert({ key: "main", value: s, updated_at: new Date().toISOString() });
  if (error) throw error;
}
export async function getCursor(): Promise<number> {
  const { data } = await db().from("growth_settings").select("value").eq("key", "discover_cursor").maybeSingle();
  return Number(data?.value ?? 0);
}
export async function setCursor(n: number): Promise<void> {
  await db().from("growth_settings").upsert({ key: "discover_cursor", value: n, updated_at: new Date().toISOString() });
}

// ── leads ───────────────────────────────────────────────────────────────
export async function insertDiscovered(rows: Array<Record<string, unknown>>): Promise<number> {
  if (rows.length === 0) return 0;
  const { data, error } = await db().from("outreach_leads")
    .upsert(rows, { onConflict: "place_id", ignoreDuplicates: true }).select("id");
  if (error) throw error;
  return data?.length ?? 0;
}
export async function listLeads(opts: { stage?: Stage | Stage[]; limit?: number; dueBefore?: string } = {}): Promise<OutreachLead[]> {
  let q = db().from("outreach_leads").select("*").order("score", { ascending: false }).limit(opts.limit ?? 100);
  if (opts.stage) q = Array.isArray(opts.stage) ? q.in("stage", opts.stage) : q.eq("stage", opts.stage);
  if (opts.dueBefore) q = q.lte("next_action_at", opts.dueBefore);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(toLead);
}
export async function getLead(id: string): Promise<OutreachLead | null> {
  const { data } = await db().from("outreach_leads").select("*").eq("id", id).maybeSingle();
  return data ? toLead(data) : null;
}
export async function updateLead(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await db().from("outreach_leads").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error && error.code !== "23505") throw error;
  if (error?.code === "23505") {
    // Another lead already owns this email — drop the duplicate rather than double-mailing.
    await db().from("outreach_leads").update({ stage: "lost", notes: "duplicate email", updated_at: new Date().toISOString() }).eq("id", id);
  }
}
export async function stageCounts(): Promise<Record<string, number>> {
  const { data, error } = await db().from("outreach_leads").select("stage").limit(20000);
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const r of data ?? []) out[r.stage] = (out[r.stage] ?? 0) + 1;
  return out;
}

// ── messages ────────────────────────────────────────────────────────────
export async function createMessage(m: { leadId: string; step: number; subject: string; bodyText: string; status: MessageStatus }): Promise<void> {
  const { error } = await db().from("outreach_messages").insert({ lead_id: m.leadId, step: m.step, subject: m.subject, body_text: m.bodyText, status: m.status });
  if (error) throw error;
}
export async function listMessages(status: MessageStatus, limit = 50): Promise<Array<OutreachMessage & { lead?: OutreachLead }>> {
  const { data, error } = await db().from("outreach_messages").select("*, outreach_leads(*)").eq("status", status).order("created_at", { ascending: true }).limit(limit);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ ...toMsg(r), lead: r.outreach_leads ? toLead(r.outreach_leads) : undefined }));
}
export async function updateMessage(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await db().from("outreach_messages").update(patch).eq("id", id);
  if (error) throw error;
}
export async function sentSince(iso: string): Promise<number> {
  const { count } = await db().from("outreach_messages").select("id", { count: "exact", head: true }).eq("status", "sent").gte("sent_at", iso);
  return count ?? 0;
}
export async function firstSentAt(): Promise<string | null> {
  const { data } = await db().from("outreach_messages").select("sent_at").eq("status", "sent").order("sent_at", { ascending: true }).limit(1).maybeSingle();
  return data?.sent_at ?? null;
}
export async function hasMessageForStep(leadId: string, step: number): Promise<boolean> {
  const { count } = await db().from("outreach_messages").select("id", { count: "exact", head: true }).eq("lead_id", leadId).eq("step", step);
  return (count ?? 0) > 0;
}

// ── suppression + replies ───────────────────────────────────────────────
export async function suppress(email: string, reason: string): Promise<void> {
  await db().from("outreach_suppressions").upsert({ email: email.toLowerCase(), reason });
}
export async function isSuppressed(email: string): Promise<boolean> {
  const { data } = await db().from("outreach_suppressions").select("email").eq("email", email.toLowerCase()).maybeSingle();
  return !!data;
}

const ACTIVE: Stage[] = ["discovered", "enriched", "drafted", "queued", "contacted"];

/** Stops any sequence to this address and moves the lead forward. Safe to call for emails we never mailed. */
export async function markOutreachReplied(email: string, stage: "replied" | "demo_booked" = "replied"): Promise<void> {
  try {
    const { data } = await db().from("outreach_leads").select("id").ilike("email", email.trim().replace(/[%_]/g, "\\$&")).in("stage", ACTIVE);
    for (const row of data ?? []) {
      await db().from("outreach_leads").update({ stage, next_action_at: null, updated_at: new Date().toISOString() }).eq("id", row.id);
      await db().from("outreach_messages").update({ status: "skipped" }).eq("lead_id", row.id).in("status", ["draft", "approved"]);
    }
  } catch (err) {
    console.error("[growth] markOutreachReplied failed:", err);
  }
}

export async function markUnsubscribed(leadId: string): Promise<void> {
  const lead = await getLead(leadId);
  if (!lead) return;
  if (lead.email) await suppress(lead.email, "unsubscribed");
  await updateLead(leadId, { stage: "unsubscribed", next_action_at: null });
  await db().from("outreach_messages").update({ status: "skipped" }).eq("lead_id", leadId).in("status", ["draft", "approved"]);
}

export async function getSupabaseLeadIdForMessage(messageId: string): Promise<string | null> {
  const { data } = await db().from("outreach_messages").select("lead_id").eq("id", messageId).maybeSingle();
  return data?.lead_id ?? null;
}

export async function getMessageStep(messageId: string): Promise<number | null> {
  const { data } = await db().from("outreach_messages").select("step").eq("id", messageId).maybeSingle();
  return data?.step ?? null;
}

/** Adds one hand-entered lead. The place_id "manual:<host>" makes the same site a duplicate, so pasting it twice is harmless. */
export async function insertManualLead(row: { host: string; website: string; name: string; email?: string; industry?: string; city?: string; country?: string }): Promise<"added" | "updated" | "duplicate"> {
  const { error } = await db().from("outreach_leads").insert({
    place_id: `manual:${row.host}`,
    business_name: row.name,
    industry: row.industry ?? null,
    city: row.city ?? null,
    country: row.country ?? null,
    website: row.website,
    email: row.email ?? null,
    source: "manual",
    // A supplied email skips the "find emails" step.
    stage: row.email ? "enriched" : "discovered",
  });
  if (!error) return "added";
  if (error.code !== "23505") throw error;

  // Already in the list. If you pasted it again WITH an email and we had none, fill it in.
  if (row.email) {
    const { data } = await db().from("outreach_leads")
      .update({ email: row.email, stage: "enriched", updated_at: new Date().toISOString() })
      .eq("place_id", `manual:${row.host}`).is("email", null).in("stage", ["discovered", "no_email"]).select("id");
    if (data?.length) return "updated";
  }
  return "duplicate"; // same site, or the email already belongs to another lead
}
