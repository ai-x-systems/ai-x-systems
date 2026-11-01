import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/accounts/session";
import { getStoredBusiness, updateBusinessConfig } from "@/lib/config/business-store";
import { saveNotifyEmailOverride } from "@/lib/config/overrides";
import { sendWebhook } from "@/lib/integrations/webhook";
import { logLead } from "@/lib/integrations/sheets";
import { isSafeWebhookUrl, sheetIdFrom } from "@/lib/integrations/url-guard";
import { rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cap = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

/** Client: save where their leads go (alert email, CRM/automation webhook, Google Sheet) and send test leads. */
export async function POST(req: NextRequest) {
  const session = await getClientSession();
  if (!session?.businessId) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  const businessId = session.businessId;
  const stored = await getStoredBusiness(businessId);
  if (!stored || stored.source !== "db") return NextResponse.json({ success: false, error: "These settings can't be changed from here. Please contact us." }, { status: 400 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = b.action;

  if (action === "save") {
    const notifyEmail = cap(b.notifyEmail, 200);
    const webhookUrl = cap(b.webhookUrl, 500);
    const sheetRaw = cap(b.leadSheet, 300);
    const tab = cap(b.leadSheetTabName, 80);
    if (notifyEmail && !EMAIL.test(notifyEmail)) return NextResponse.json({ success: false, error: "That alert email doesn't look right." }, { status: 400 });
    if (webhookUrl && !isSafeWebhookUrl(webhookUrl)) return NextResponse.json({ success: false, error: "The CRM / automation address must be a public https link (like the one Zapier, Make or n8n gives you)." }, { status: 400 });
    const sheetId = sheetRaw ? sheetIdFrom(sheetRaw) : "";
    if (sheetRaw && !sheetId) return NextResponse.json({ success: false, error: "Paste the Google Sheet link (or its id) from your browser's address bar." }, { status: 400 });

    const r = await updateBusinessConfig(businessId, (c) => ({
      ...c,
      integrations: {
        ...c.integrations,
        notifyEmail: notifyEmail || c.integrations.notifyEmail,
        webhookUrl: webhookUrl || undefined,
        leadSheetId: sheetId || undefined,
        leadSheetTabName: sheetId ? tab || undefined : undefined,
      },
    }));
    if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: 400 });
    if (notifyEmail) await saveNotifyEmailOverride(businessId, notifyEmail); // keeps the chat/voice alert email in step
    return NextResponse.json({ success: true });
  }

  if (action === "test_webhook" || action === "test_sheet") {
    if ((await rateLimit(`integ-test:${businessId}`, 12, 3600)).limited) return NextResponse.json({ success: false, error: "Too many tests. Try again in a little while." }, { status: 429 });
    const i = stored.config.integrations;
    const when = new Date().toISOString();
    if (action === "test_webhook") {
      if (!i.webhookUrl) return NextResponse.json({ success: false, error: "Save a CRM / automation address first." }, { status: 400 });
      const r = await sendWebhook(i.webhookUrl, { event: "test", businessId, timestampISO: when, data: { callerName: "Test Lead", callerEmail: "test@example.com", callerPhone: "+15555550100", reason: "This is a test from your AI Receptionist dashboard." } });
      return NextResponse.json({ success: r.success, error: r.success ? undefined : r.error ?? "The test did not go through." }, { status: r.success ? 200 : 502 });
    }
    if (!i.leadSheetId) return NextResponse.json({ success: false, error: "Save your Google Sheet first." }, { status: 400 });
    const r = await logLead({ businessId, callerName: "Test Lead", callerPhone: "+15555550100", callerEmail: "test@example.com", reason: "Test row from your AI Receptionist dashboard.", callTimestampISO: when }, i.leadSheetId, i.leadSheetTabName);
    return NextResponse.json({ success: r.success, error: r.success ? undefined : "We couldn't add a row. Check that the sheet is shared with our address as Editor, and that the tab name is right." }, { status: r.success ? 200 : 502 });
  }

  return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
}
