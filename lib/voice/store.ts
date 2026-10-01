import "server-only";
import { getSupabaseClient } from "@/lib/supabase/client";

export interface VoiceLine {
  businessId: string;
  e164: string;
  vapiPhoneNumberId?: string;
  forwardTo?: string;
  sellCentsPerMinute: number;
  enabled: boolean;
}

export interface VoiceCall {
  callId: string;
  businessId: string;
  caller?: string;
  durationSeconds: number;
  billedMinutes: number;
  vapiCostCents?: number;
  endedReason?: string;
  createdAtISO: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const toLine = (r: any): VoiceLine => ({
  businessId: r.business_id, e164: r.e164, vapiPhoneNumberId: r.vapi_phone_number_id ?? undefined,
  forwardTo: r.forward_to ?? undefined, sellCentsPerMinute: r.sell_cents_per_minute ?? 0, enabled: r.enabled !== false,
});
const toCall = (r: any): VoiceCall => ({
  callId: r.call_id, businessId: r.business_id, caller: r.caller ?? undefined, durationSeconds: r.duration_seconds ?? 0,
  billedMinutes: r.billed_minutes ?? 0, vapiCostCents: r.vapi_cost_cents != null ? Number(r.vapi_cost_cents) : undefined,
  endedReason: r.ended_reason ?? undefined, createdAtISO: r.created_at,
});

const db = () => getSupabaseClient();

export async function findLine(by: { e164?: string; phoneNumberId?: string }): Promise<VoiceLine | null> {
  if (by.e164) {
    const { data } = await db().from("voice_lines").select("*").eq("e164", by.e164).maybeSingle();
    if (data) return toLine(data);
  }
  if (by.phoneNumberId) {
    const { data } = await db().from("voice_lines").select("*").eq("vapi_phone_number_id", by.phoneNumberId).maybeSingle();
    if (data) return toLine(data);
  }
  return null;
}

export async function getLineForBusiness(businessId: string): Promise<VoiceLine | null> {
  const { data } = await db().from("voice_lines").select("*").eq("business_id", businessId).maybeSingle();
  return data ? toLine(data) : null;
}

export async function listLines(): Promise<VoiceLine[]> {
  const { data, error } = await db().from("voice_lines").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toLine);
}

export async function upsertLine(l: VoiceLine): Promise<void> {
  const { error } = await db().from("voice_lines").upsert({
    business_id: l.businessId, e164: l.e164, vapi_phone_number_id: l.vapiPhoneNumberId ?? null,
    forward_to: l.forwardTo ?? null, sell_cents_per_minute: l.sellCentsPerMinute, enabled: l.enabled,
  }, { onConflict: "business_id" });
  if (error) throw error;
}

/** Returns false if this call was already recorded (Vapi retried) — the caller must then NOT charge again. */
export async function insertCall(c: Omit<VoiceCall, "createdAtISO">): Promise<boolean> {
  const { error } = await db().from("voice_calls").insert({
    call_id: c.callId, business_id: c.businessId, caller: c.caller ?? null, duration_seconds: c.durationSeconds,
    billed_minutes: c.billedMinutes, vapi_cost_cents: c.vapiCostCents ?? null, ended_reason: c.endedReason ?? null,
  });
  if (error) {
    if (error.code === "23505") return false;
    throw error;
  }
  return true;
}

export async function deleteCall(callId: string): Promise<void> {
  await db().from("voice_calls").delete().eq("call_id", callId);
}

export async function listCalls(businessId: string | null, limit = 50): Promise<VoiceCall[]> {
  let q = db().from("voice_calls").select("*").order("created_at", { ascending: false }).limit(limit);
  if (businessId) q = q.eq("business_id", businessId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(toCall);
}
