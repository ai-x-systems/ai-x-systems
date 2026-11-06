import "server-only";
import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Client requests ("I want a phone number", "please install the chat on my site").
 * Stored in the existing billing_events table (type "request.*") so no database change is needed;
 * the billing and sales screens only read their own event types and never see these.
 */
export type RequestKind = "phone" | "chat_install";
export type RequestStatus = "pending" | "done" | "declined";

export interface ClientRequest {
  id: string; // billing_events.event_id
  kind: RequestKind;
  businessId: string;
  email: string | null;
  status: RequestStatus;
  details: Record<string, unknown>;
  createdAtISO: string;
}

type Row = { event_id: string; type: string; business_id: string | null; email: string | null; created_at: string; payload: { status?: RequestStatus; details?: Record<string, unknown> } | null };
const toRequest = (r: Row): ClientRequest => ({
  id: r.event_id,
  kind: r.type.replace("request.", "") as RequestKind,
  businessId: r.business_id ?? "",
  email: r.email,
  status: r.payload?.status ?? "pending",
  details: r.payload?.details ?? {},
  createdAtISO: r.created_at,
});

export async function createRequest(kind: RequestKind, businessId: string, email: string | null, details: Record<string, unknown>) {
  const { error } = await getSupabaseClient().from("billing_events").insert({
    event_id: `request:${crypto.randomUUID()}`, type: `request.${kind}`, business_id: businessId, email,
    payload: { status: "pending", details },
  });
  if (error) throw error;
}

export async function listRequests(opts: { businessId?: string; status?: RequestStatus; limit?: number } = {}): Promise<ClientRequest[]> {
  let q = getSupabaseClient().from("billing_events").select("event_id,type,business_id,email,created_at,payload").like("type", "request.%").order("created_at", { ascending: false }).limit(opts.limit ?? 100);
  if (opts.businessId) q = q.eq("business_id", opts.businessId);
  const { data } = await q;
  const all = ((data ?? []) as Row[]).map(toRequest);
  return opts.status ? all.filter((r) => r.status === opts.status) : all;
}

export async function setRequestStatus(id: string, status: RequestStatus): Promise<void> {
  const db = getSupabaseClient();
  const { data } = await db.from("billing_events").select("payload").eq("event_id", id).like("type", "request.%").maybeSingle();
  if (!data) return;
  await db.from("billing_events").update({ payload: { ...(data.payload as object), status } }).eq("event_id", id);
}

/** When you attach a line or finish an install, close that client's open requests of that kind. */
export async function completeOpenRequests(businessId: string, kind: RequestKind): Promise<void> {
  const open = await listRequests({ businessId, status: "pending" });
  await Promise.all(open.filter((r) => r.kind === kind).map((r) => setRequestStatus(r.id, "done")));
}

export async function deleteRequest(id: string): Promise<void> {
  await getSupabaseClient().from("billing_events").delete().eq("event_id", id).like("type", "request.%");
}
