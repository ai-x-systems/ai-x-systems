import "server-only";
import { getSupabaseClient } from "@/lib/supabase/client";
import { BusinessConfigSchema, type BusinessConfig } from "@/lib/config/business-schema";
import { getBusinessById as getFileBusiness, getAllBusinesses as getFileBusinesses } from "@/config/businesses";

/**
 * Where a business config comes from:
 *   1. a row in the `businesses` table (created by /admin/onboard) — wins
 *   2. otherwise data/businesses/<id>.json (your original two)
 * so existing businesses keep working with zero changes, and new clients
 * never need a Git commit.
 *
 * A 30s per-instance cache keeps this off the hot path of every chat
 * message; saving a business clears it on the instance that handled the save.
 */

export interface StoredBusiness {
  config: BusinessConfig;
  clientEmail?: string;
  billingStatus: string;
  active: boolean;
  source: "db" | "file";
}

const TTL_MS = 30_000;
const cache = new Map<string, { at: number; value: StoredBusiness | null }>();

/* eslint-disable @typescript-eslint/no-explicit-any */
function fromRow(row: any): StoredBusiness | null {
  const parsed = BusinessConfigSchema.safeParse(row.config);
  if (!parsed.success) {
    console.error("[businesses] invalid stored config for", row.id, parsed.error.message);
    return null;
  }
  return {
    config: parsed.data,
    clientEmail: row.client_email ?? undefined,
    billingStatus: row.billing_status ?? "awaiting_payment",
    active: row.active !== false,
    source: "db",
  };
}

export async function getStoredBusiness(id: string): Promise<StoredBusiness | null> {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  let value: StoredBusiness | null = null;
  try {
    const { data, error } = await getSupabaseClient().from("businesses").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (data) value = fromRow(data);
  } catch (err) {
    // DB hiccup must never take a file-based business (your own chatbot) offline.
    console.error("[businesses] DB lookup failed, falling back to files:", err);
  }
  if (!value) {
    const f = getFileBusiness(id);
    if (f) value = { config: f, billingStatus: "active", active: true, source: "file" };
  }
  cache.set(id, { at: Date.now(), value });
  return value;
}

/** Drop-in async replacement for getBusinessById. */
export async function getBusiness(id: string): Promise<BusinessConfig | undefined> {
  return (await getStoredBusiness(id))?.config;
}

export async function listStoredBusinesses(): Promise<StoredBusiness[]> {
  const out = new Map<string, StoredBusiness>();
  for (const f of getFileBusinesses()) out.set(f.id, { config: f, billingStatus: "active", active: true, source: "file" });
  try {
    const { data, error } = await getSupabaseClient().from("businesses").select("*");
    if (error) throw error;
    for (const row of data ?? []) {
      const b = fromRow(row);
      if (b) out.set(row.id, b);
    }
  } catch (err) {
    console.error("[businesses] list failed:", err);
  }
  return [...out.values()];
}

export async function businessIdTaken(id: string): Promise<boolean> {
  if (getFileBusiness(id)) return true;
  const { data } = await getSupabaseClient().from("businesses").select("id").eq("id", id).maybeSingle();
  return !!data;
}

export async function saveNewBusiness(config: BusinessConfig, clientEmail?: string): Promise<void> {
  const { error } = await getSupabaseClient().from("businesses").insert({
    id: config.id,
    config,
    client_email: clientEmail?.toLowerCase() ?? null,
    source: "onboarding",
  });
  if (error) throw error;
  cache.delete(config.id);
}

export async function setBusinessFlags(id: string, patch: { active?: boolean; billing_status?: string }): Promise<boolean> {
  const { data, error } = await getSupabaseClient()
    .from("businesses")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  cache.delete(id);
  return (data?.length ?? 0) > 0;
}

export function installSnippet(origin: string, businessId: string): string {
  return `<script src="${origin}/widget.js" data-business-id="${businessId}" defer></script>`;
}
