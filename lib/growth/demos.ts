import "server-only";
import { getSupabaseClient } from "@/lib/supabase/client";
import { deleteBusinessRow } from "@/lib/config/business-store";
import { createPreviewBusiness } from "@/lib/onboarding/demo";
import { listLeads, updateLead } from "./store";

const MAX_ATTEMPTS = 3;

/** Builds a private preview for up to `limit` enriched leads per run (each takes ~10-20s: site fetch + AI). */
export async function demoBatch(limit = 3): Promise<{ built: number; skipped: number; retry: number }> {
  const leads = (await listLeads({ stage: "enriched", limit: 40 })).filter((l) => !l.demoBusinessId && !l.signals.demoSkipped);
  let built = 0, skipped = 0, retry = 0;

  for (const lead of leads.slice(0, limit)) {
    if (!lead.website) { await updateLead(lead.id, { signals: { ...lead.signals, demoSkipped: true } }); skipped++; continue; }
    let res;
    try {
      res = await createPreviewBusiness({ name: lead.businessName, industry: lead.industry, website: lead.website, phone: lead.phone, address: undefined });
    } catch (err) {
      console.error("[demos] preview build failed:", err);
      res = { ok: false as const, reason: "transient" as const, message: "error" };
    }

    if (res.ok) {
      await updateLead(lead.id, { demo_business_id: res.businessId });
      built++;
    } else {
      const attempts = (lead.signals.demoAttempts ?? 0) + 1;
      const giveUp = res.reason === "unusable" || attempts >= MAX_ATTEMPTS;
      await updateLead(lead.id, { signals: { ...lead.signals, demoAttempts: attempts, ...(giveUp ? { demoSkipped: true } : {}) } });
      if (giveUp) skipped++; else retry++;
    }
  }
  return { built, skipped, retry };
}

/** Previews older than 30 days are deleted, unless the prospect has engaged (replied, booked, won). */
export async function cleanupDemos(): Promise<{ deleted: number }> {
  const db = getSupabaseClient();
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: old } = await db.from("businesses").select("id").eq("source", "demo").lt("created_at", cutoff).limit(50);
  let deleted = 0;
  for (const row of old ?? []) {
    const { data: lead } = await db.from("outreach_leads").select("id, stage").eq("demo_business_id", row.id).maybeSingle();
    if (lead && ["replied", "demo_booked", "won"].includes(lead.stage)) continue;
    await deleteBusinessRow(row.id);
    if (lead) await db.from("outreach_leads").update({ demo_business_id: null, updated_at: new Date().toISOString() }).eq("id", lead.id);
    deleted++;
  }
  return { deleted };
}
