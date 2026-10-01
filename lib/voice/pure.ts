/**
 * Pure helpers for the Vapi voice webhook — no I/O, no server-only import,
 * so they are unit tested directly (npm run test:voice).
 */
import crypto from "crypto";

// ── auth ────────────────────────────────────────────────────────────────
function safeEq(a: string, b: string): boolean {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Per-business token embedded in the in-call webhook URL, so the master secret never leaves us. */
export function scopedToken(secret: string, businessId: string): string {
  return crypto.createHmac("sha256", secret).update(`voice:${businessId}`).digest("base64url");
}

export type VoiceAuth =
  | { level: "full" }                        // master secret: may resolve the business from the dialed number
  | { level: "scoped"; businessId: string }  // per-business token: only that business
  | { level: "none" };

/**
 * Accepts the master secret as `X-Vapi-Secret`, `Authorization: Bearer`, or `?k=`
 * (phone-number-level webhook), or a per-business `?b=&t=` token (in-call events).
 */
export function authorizeVoice(
  secret: string | undefined,
  input: { xVapiSecret?: string | null; authorization?: string | null; k?: string | null; b?: string | null; t?: string | null }
): VoiceAuth {
  if (!secret) return { level: "none" };
  const bearer = input.authorization?.replace(/^Bearer\s+/i, "");
  if ((input.xVapiSecret && safeEq(input.xVapiSecret, secret)) || (bearer && safeEq(bearer, secret)) || (input.k && safeEq(input.k, secret))) {
    return { level: "full" };
  }
  if (input.b && input.t && safeEq(input.t, scopedToken(secret, input.b))) return { level: "scoped", businessId: input.b };
  return { level: "none" };
}

// ── numbers, time, money ────────────────────────────────────────────────
export function normalizeE164(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/[^\d+]/g, "");
  const d = digits.replace(/^\+/, "");
  if (!/^\d{8,15}$/.test(d)) return undefined;
  if (digits.startsWith("+")) return `+${d}`;
  return d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith("1") ? `+${d}` : `+${d}`;
}

/** Answered calls under 5s (hang-ups, wrong numbers) are free; everything else rounds UP to whole minutes. */
export function billedMinutes(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 5) return 0;
  return Math.ceil(durationSeconds / 60);
}

/** A call may never outlast the prepaid balance: duration <= cap ⇒ ceil(duration/60) <= balance. */
export function maxCallSeconds(balanceMinutes: number, hardCapSeconds: number): number {
  const fromBalance = Math.floor(balanceMinutes) * 60;
  return Math.max(60, Math.min(hardCapSeconds, fromBalance));
}

// ── Vapi payload parsing (defensive: the shapes vary slightly by event/version) ──
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

export function parseToolCalls(message: Obj): Array<{ id: string; name: string; args: Record<string, unknown> }> {
  const list = Array.isArray(message.toolCallList) ? message.toolCallList : [];
  const out: Array<{ id: string; name: string; args: Record<string, unknown> }> = [];
  for (const raw of list) {
    if (!isObj(raw) || typeof raw.id !== "string") continue;
    const fn = isObj(raw.function) ? raw.function : undefined;
    const name = (fn?.name ?? raw.name) as unknown;
    if (typeof name !== "string") continue;
    let args: unknown = fn?.arguments ?? raw.parameters ?? raw.arguments ?? {};
    if (typeof args === "string") { try { args = JSON.parse(args); } catch { args = {}; } }
    out.push({ id: raw.id, name, args: isObj(args) ? args : {} });
  }
  return out;
}

function ms(v: unknown): number | undefined {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : undefined;
}

export function extractDurationSeconds(message: Obj): number {
  const call = isObj(message.call) ? message.call : {};
  for (const v of [message.durationSeconds, call.durationSeconds]) if (typeof v === "number" && v >= 0) return Math.round(v);
  for (const v of [message.durationMs, call.durationMs]) if (typeof v === "number" && v >= 0) return Math.round(v / 1000);
  const start = ms(message.startedAt) ?? ms(call.startedAt);
  const end = ms(message.endedAt) ?? ms(call.endedAt);
  return start !== undefined && end !== undefined && end >= start ? Math.round((end - start) / 1000) : 0;
}

/** Vapi's own cost for the call, in US cents (what YOU paid). */
export function extractCostCents(message: Obj): number | undefined {
  const call = isObj(message.call) ? message.call : {};
  for (const v of [message.cost, call.cost]) if (typeof v === "number" && v >= 0) return Math.round(v * 10000) / 100;
  return undefined;
}

export function extractCalledNumber(message: Obj): string | undefined {
  const call = isObj(message.call) ? message.call : {};
  const a = isObj(message.phoneNumber) ? message.phoneNumber : {};
  const b = isObj(call.phoneNumber) ? call.phoneNumber : {};
  return normalizeE164((a.number ?? b.number) as string | undefined);
}

export function extractPhoneNumberId(message: Obj): string | undefined {
  const call = isObj(message.call) ? message.call : {};
  const a = isObj(message.phoneNumber) ? message.phoneNumber : {};
  const id = call.phoneNumberId ?? a.id;
  return typeof id === "string" ? id : undefined;
}

export function extractCaller(message: Obj): string | undefined {
  const call = isObj(message.call) ? message.call : {};
  const c = isObj(message.customer) ? message.customer : isObj(call.customer) ? call.customer : {};
  return normalizeE164(c.number as string | undefined);
}

/** Minute packs: {"<freemius plan or pricing id>": minutes}. Returns minutes to credit for the first known id in the payload. */
export function minutesForPayment(payload: unknown, packs: Record<string, number>): number {
  const seen = new Set<unknown>();
  const found: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object" || seen.has(n)) return;
    seen.add(n);
    for (const [k, v] of Object.entries(n as Obj)) {
      if ((k === "plan_id" || k === "pricing_id") && (typeof v === "string" || typeof v === "number")) found.push(String(v));
      walk(v);
    }
  };
  walk(payload);
  for (const id of found) if (Number.isFinite(packs[id]) && packs[id] > 0) return Math.floor(packs[id]);
  return 0;
}

export function parsePacks(json: string | undefined): Record<string, number> {
  if (!json) return {};
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === "number" && v > 0).map(([k, v]) => [k, v as number]));
  } catch { return {}; }
}

/** Short, plain instructions appended to the shared system prompt for phone calls. */
export const PHONE_ADDENDUM =
  "\n\nPHONE CALL RULES: You are speaking out loud. Keep every reply to one or two short sentences. Never read out URLs, ids, or punctuation. Say numbers and times naturally. Early in the call, make clear you are an AI assistant if the caller asks. If the caller wants a human, or you cannot help, offer to take their name and number so the team can call back (use the log_lead tool), and never invent information.";
