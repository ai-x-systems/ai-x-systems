import "server-only";
import { siteConfig } from "@/lib/site-config";

/**
 * Talks to Vapi's REST API so you don't have to click through their dashboard for every client number.
 * Needs VAPI_API_KEY (Vapi dashboard > API Keys > the PRIVATE key; never the public one) in Vercel.
 */
const BASE = "https://api.vapi.ai";

export const vapiConfigured = () => Boolean(process.env.VAPI_API_KEY);

/** The address Vapi must call for every phone number: it carries the secret that proves the call is from Vapi. */
export function voiceWebhookUrl(): string | null {
  const secret = process.env.VOICE_WEBHOOK_SECRET;
  if (!secret) return null;
  return `${siteConfig.brand.baseUrl.replace(/\/+$/, "")}/api/voice/vapi?k=${secret}`;
}

async function call(method: "GET" | "PATCH", path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.VAPI_API_KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try { json = text ? JSON.parse(text) : {}; } catch { /* non-JSON error page */ }
  return { ok: res.ok, status: res.status, json, text };
}

const msg = (r: { json: Record<string, unknown>; status: number }) => {
  const m = r.json.message;
  return (Array.isArray(m) ? m.join("; ") : typeof m === "string" ? m : `Vapi answered with status ${r.status}`).slice(0, 300);
};

export interface NumberCheck { ok: true; number?: string; assistantAttached: boolean; serverUrlSet: boolean }

/**
 * Points a Vapi phone number at your webhook, so each incoming call asks YOUR system which client and
 * assistant to use. Doesn't touch the number's other settings.
 */
export async function connectNumberToWebhook(vapiPhoneNumberId: string): Promise<NumberCheck | { ok: false; error: string }> {
  if (!vapiConfigured()) return { ok: false, error: "VAPI_API_KEY is not set in Vercel yet." };
  const url = voiceWebhookUrl();
  if (!url) return { ok: false, error: "VOICE_WEBHOOK_SECRET is not set in Vercel." };
  const id = encodeURIComponent(vapiPhoneNumberId.trim());

  let r = await call("PATCH", `/phone-number/${id}`, { server: { url } });
  if (!r.ok && r.status === 400) r = await call("PATCH", `/phone-number/${id}`, { serverUrl: url }); // older accounts use the flat field
  if (!r.ok) return { ok: false, error: r.status === 401 || r.status === 403 ? "Vapi refused the key. Use the PRIVATE API key from Vapi → API Keys." : r.status === 404 ? "Vapi doesn't know that phone number id. Copy it from the number's page in Vapi." : msg(r) };

  const check = await call("GET", `/phone-number/${id}`);
  const j = check.json;
  const server = j.server as { url?: string } | undefined;
  return {
    ok: true,
    number: typeof j.number === "string" ? j.number : typeof j.sipUri === "string" ? j.sipUri : undefined,
    assistantAttached: typeof j.assistantId === "string" && j.assistantId.length > 0,
    serverUrlSet: Boolean(server?.url || j.serverUrl),
  };
}
