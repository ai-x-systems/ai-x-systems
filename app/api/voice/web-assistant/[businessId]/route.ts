import { NextRequest, NextResponse } from "next/server";
import { getStoredBusiness } from "@/lib/config/business-store";
import { isDemoId } from "@/lib/onboarding/build-config";
import { buildTransientAssistant } from "@/lib/voice/assistant";
import { scopedToken } from "@/lib/voice/pure";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";
import { siteConfig } from "@/lib/site-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Browser "Talk to the receptionist" demo, no phone number needed.
 *
 * Returns the SAME transient assistant the phone line would get (same prompt, tools and
 * knowledge), and the browser hands it to Vapi's web SDK. Tool calls (log_lead, booking) and the
 * end-of-call report go to /api/voice/vapi with the per-business scoped token, so leads are logged
 * exactly like phone calls.
 *
 * Demo previews only (id starts with "demo-"), 2 minutes max, never billed to anyone, and
 * rate-limited because every call spends YOUR Vapi credits:
 *   WEB_VOICE_PER_IP_HOURLY (default 3), WEB_VOICE_DAILY_CAP (default 25 calls/day, all previews).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const secret = process.env.VOICE_WEBHOOK_SECRET;
  if (!secret || !isDemoId(businessId)) return NextResponse.json({ error: "Not available" }, { status: 404 });

  const perIp = Number(process.env.WEB_VOICE_PER_IP_HOURLY) || 3;
  const daily = Number(process.env.WEB_VOICE_DAILY_CAP) || 25;
  const [ip, day] = await Promise.all([
    rateLimit(`webvoice:${clientIp(req)}`, perIp, 3600),
    rateLimit("webvoice-day", daily, 86400),
  ]);
  if (ip.limited || day.limited) {
    return NextResponse.json(
      { error: "The live voice demo is busy right now. Please try again later, or reply to our email and we will arrange a call." },
      { status: 429 }
    );
  }

  const stored = await getStoredBusiness(businessId);
  if (!stored || stored.source !== "db" || !stored.config.demo || !stored.active) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const origin = (process.env.NEXT_PUBLIC_SITE_URL || siteConfig.brand.baseUrl).replace(/\/+$/, "");
  const webhookUrl = `${origin}/api/voice/vapi?b=${encodeURIComponent(businessId)}&t=${scopedToken(secret, businessId)}`;
  const hardCap = Number(process.env.VOICE_MAX_CALL_SECONDS) || 900;
  const assistant = await buildTransientAssistant(stored.config, { webhookUrl, maxDurationSeconds: Math.min(120, hardCap) });

  return NextResponse.json({ assistant }, { headers: { "Cache-Control": "no-store" } });
}
