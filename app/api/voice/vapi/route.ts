import { NextRequest, NextResponse } from "next/server";
import { creditLedger } from "@/lib/billing/credits";
import { getStoredBusiness } from "@/lib/config/business-store";
import { executeToolCall } from "@/lib/tools/execute-tool-call";
import { sendEmailTo, sendFounderAlert } from "@/lib/integrations/notify";
import { getEffectiveBusinessConfig } from "@/lib/config/overrides";
import { siteConfig } from "@/lib/site-config";
import { buildTransientAssistant } from "@/lib/voice/assistant";
import { deleteCall, findLine, getLineForBusiness, insertCall } from "@/lib/voice/store";
import {
  authorizeVoice, billedMinutes, extractCalledNumber, extractCaller, extractCostCents, extractDurationSeconds,
  extractPhoneNumberId, maxCallSeconds, parseToolCalls, scopedToken,
} from "@/lib/voice/pure";

export const runtime = "nodejs";
export const maxDuration = 30;

type Msg = Record<string, unknown>;
const BUSY = "Sorry, we can't take your call right now. Please try again shortly, or contact the business directly.";

/**
 * The one URL Vapi talks to. Set it as the Server URL of each business's
 * phone number in the Vapi dashboard (leave "assistant" empty):
 *     https://<domain>/api/voice/vapi?k=<VOICE_WEBHOOK_SECRET>
 *
 *  assistant-request  → look up the business by the dialed number, check the
 *                       prepaid balance, cap the call length to it, return a
 *                       transient assistant (or forward to a human if out of minutes)
 *  tool-calls         → the same book_appointment / log_lead code the chat uses
 *  end-of-call-report → debit the minutes used (idempotent per call id)
 */
export async function POST(req: NextRequest) {
  const secret = process.env.VOICE_WEBHOOK_SECRET;
  const q = req.nextUrl.searchParams;
  const auth = authorizeVoice(secret, {
    xVapiSecret: req.headers.get("x-vapi-secret"),
    authorization: req.headers.get("authorization"),
    k: q.get("k"), b: q.get("b"), t: q.get("t"),
  });
  if (auth.level === "none") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let message: Msg;
  try {
    const body = (await req.json()) as { message?: Msg };
    message = body.message ?? {};
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const type = typeof message.type === "string" ? message.type : "";

  try {
    if (type === "assistant-request") {
      if (auth.level !== "full") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return await handleAssistantRequest(req, message, secret!);
    }
    if (type === "tool-calls") return await handleToolCalls(message, await resolveBusinessId(auth, message, q.get("b")));
    if (type === "end-of-call-report") return await handleEndOfCall(message, await resolveBusinessId(auth, message, q.get("b")));
  } catch (err) {
    console.error(`[voice] ${type} failed:`, err);
    // Only end-of-call must be retried by Vapi; for the others a 200 with a spoken error is kinder to the caller.
    if (type === "end-of-call-report") return NextResponse.json({ error: "Processing error" }, { status: 500 });
    if (type === "assistant-request") return NextResponse.json({ error: BUSY });
  }
  return NextResponse.json({ ok: true });
}

async function resolveBusinessId(auth: ReturnType<typeof authorizeVoice>, message: Msg, b: string | null): Promise<string | null> {
  if (auth.level === "scoped") return auth.businessId;
  if (b) return b; // master secret + explicit business
  const line = await findLine({ e164: extractCalledNumber(message), phoneNumberId: extractPhoneNumberId(message) });
  return line?.businessId ?? null;
}

async function handleAssistantRequest(req: NextRequest, message: Msg, secret: string) {
  const line = await findLine({ e164: extractCalledNumber(message), phoneNumberId: extractPhoneNumberId(message) });
  if (!line || !line.enabled) return NextResponse.json({ error: BUSY });

  const [stored, balance] = await Promise.all([getStoredBusiness(line.businessId), creditLedger.getBalance(line.businessId)]);
  if (!stored) return NextResponse.json({ error: BUSY });

  const demo = stored.config.demo;
  const minutes = balance.balance;
  const paused = !stored.active;
  const hardCap = Number(process.env.VOICE_MAX_CALL_SECONDS) || 900;

  // Out of minutes (or paused): never drop the caller — hand them to a human if one is configured.
  if (paused || (!demo && minutes < 1)) {
    return line.forwardTo
      ? NextResponse.json({ destination: { type: "number", number: line.forwardTo, message: "One moment, I'll connect you to the team." } })
      : NextResponse.json({ error: BUSY });
  }

  const origin = (process.env.NEXT_PUBLIC_SITE_URL || siteConfig.brand.baseUrl).replace(/\/+$/, "");
  const webhookUrl = `${origin}/api/voice/vapi?b=${encodeURIComponent(line.businessId)}&t=${scopedToken(secret, line.businessId)}`;
  const assistant = await buildTransientAssistant(stored.config, {
    webhookUrl,
    maxDurationSeconds: demo ? Math.min(120, hardCap) : maxCallSeconds(minutes, hardCap),
  });
  return NextResponse.json({ assistant });
}

async function handleToolCalls(message: Msg, businessId: string | null) {
  const calls = parseToolCalls(message);
  if (!businessId) {
    return NextResponse.json({ results: calls.map((c) => ({ name: c.name, toolCallId: c.id, error: "Unknown business." })) });
  }
  const callerNumber = extractCaller(message);

  const results = [];
  for (const c of calls) {
    const args = { ...c.args };
    // The phone system knows the caller's number for certain — don't rely on the model asking for it.
    if (callerNumber && (c.name === "log_lead" || c.name === "book_appointment") && !args.callerPhone) args.callerPhone = callerNumber;
    try {
      const r = await executeToolCall({ name: c.name, arguments: args }, businessId, [], false);
      results.push({ name: c.name, toolCallId: c.id, result: r.message });
    } catch (err) {
      console.error("[voice] tool failed:", c.name, err);
      results.push({ name: c.name, toolCallId: c.id, error: "Something went wrong saving that. Please take the caller's details by voice and tell them the team will follow up." });
    }
  }
  return NextResponse.json({ results });
}

async function handleEndOfCall(message: Msg, businessId: string | null) {
  const call = (message.call ?? {}) as Msg;
  const callId = typeof call.id === "string" ? call.id : undefined;
  if (!businessId || !callId) return NextResponse.json({ ok: true, ignored: "no business or call id" });

  const stored = await getStoredBusiness(businessId);
  const durationSeconds = extractDurationSeconds(message);
  // Billing depends on this number. A zero usually means a payload field we don't read — make that visible.
  if (durationSeconds === 0) console.warn("[voice] end-of-call report had no readable duration; call", callId, "keys:", Object.keys(message).join(","));
  // Demo businesses (your own showcase lines) are never charged.
  const minutes = stored?.config.demo ? 0 : billedMinutes(durationSeconds);

  const fresh = await insertCall({
    callId, businessId, caller: extractCaller(message), durationSeconds, billedMinutes: minutes,
    vapiCostCents: extractCostCents(message),
    endedReason: typeof message.endedReason === "string" ? message.endedReason : undefined,
  });
  if (!fresh) return NextResponse.json({ ok: true, duplicate: true });
  if (minutes === 0) return NextResponse.json({ ok: true });

  let after;
  try {
    const before = (await creditLedger.getBalance(businessId)).balance;
    after = (await creditLedger.recordTransaction(businessId, "usage", -minutes, `Voice call ${callId.slice(0, 8)} · ${durationSeconds}s`)).balance;
    await maybeWarnLowBalance(businessId, before, after);
  } catch (err) {
    // Charge didn't land: remove the call row so Vapi's retry bills it instead of being skipped as a duplicate.
    await deleteCall(callId);
    throw err;
  }
  return NextResponse.json({ ok: true, billedMinutes: minutes, balance: after });
}

async function maybeWarnLowBalance(businessId: string, before: number, after: number) {
  const threshold = Number(process.env.VOICE_LOW_BALANCE_MINUTES) || 15;
  if (!(before >= threshold && after < threshold)) return;

  const stored = await getStoredBusiness(businessId);
  const notify = stored ? (await getEffectiveBusinessConfig(stored.config)).integrations.notifyEmail : undefined;
  const link = process.env.VOICE_TOPUP_URL;
  const line = await getLineForBusiness(businessId);
  const lines = [
    `${stored?.config.name ?? businessId}: your AI phone assistant has ${Math.max(0, after)} minute(s) left.`,
    link ? `Add more minutes here so calls are never interrupted: ${link}` : "Reply to this email to add more minutes.",
    line?.forwardTo ? "When minutes run out, calls are passed to your team's number." : "When minutes run out, callers hear a polite message instead of the assistant.",
  ];
  if (notify) await sendEmailTo(notify, "Your phone assistant is running low on minutes", lines);
  await sendFounderAlert(`Low voice minutes: ${businessId}`, [`${businessId} is down to ${Math.max(0, after)} minute(s).`]);
}
