import "server-only";
import { getStoredBusiness, updateBusinessConfig } from "@/lib/config/business-store";
import { saveNotifyEmailOverride } from "@/lib/config/overrides";
import { sendWebhook } from "@/lib/integrations/webhook";
import { logLead } from "@/lib/integrations/sheets";
import { isSafeWebhookUrl, sheetIdFrom } from "@/lib/integrations/url-guard";
import { rateLimit } from "@/lib/security/rate-limit";

/** Save where a client's leads go and send test leads. Shared by the client dashboard and the admin manage page. */
export interface ActionResponse { status: number; json: { success: boolean; error?: string } }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cap = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const bad = (error: string, status = 400): ActionResponse => ({ status, json: { success: false, error } });

export async function runIntegrationsAction(businessId: string, b: Record<string, unknown>): Promise<ActionResponse> {
  const stored = await getStoredBusiness(businessId);
  if (!stored || stored.source !== "db") return bad("These settings can't be changed from here. Please contact us.");

  if (b.action === "save") {
    const notifyEmail = cap(b.notifyEmail, 200);
    const webhookUrl = cap(b.webhookUrl, 500);
    const sheetRaw = cap(b.leadSheet, 300);
    const tab = cap(b.leadSheetTabName, 80);
    if (notifyEmail && !EMAIL.test(notifyEmail)) return bad("That alert email doesn't look right.");
    if (webhookUrl && !isSafeWebhookUrl(webhookUrl)) return bad("The CRM / automation address must be a public https link (like the one Zapier, Make or n8n gives you).");
    const sheetId = sheetRaw ? sheetIdFrom(sheetRaw) : "";
    if (sheetRaw && !sheetId) return bad("Paste the Google Sheet link (or its id) from your browser's address bar.");

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
    if (!r.ok) return bad(r.error);
    if (notifyEmail) await saveNotifyEmailOverride(businessId, notifyEmail); // keeps the chat/voice alert email in step
    return { status: 200, json: { success: true } };
  }

  if (b.action === "test_webhook" || b.action === "test_sheet") {
    if ((await rateLimit(`integ-test:${businessId}`, 12, 3600)).limited) return bad("Too many tests. Try again in a little while.", 429);
    const i = stored.config.integrations;
    const when = new Date().toISOString();
    if (b.action === "test_webhook") {
      if (!i.webhookUrl) return bad("Save a CRM / automation address first.");
      const r = await sendWebhook(i.webhookUrl, { event: "test", businessId, timestampISO: when, data: { callerName: "Test Lead", callerEmail: "test@example.com", callerPhone: "+15555550100", reason: "This is a test from your AI Receptionist dashboard." } });
      return r.success ? { status: 200, json: { success: true } } : bad(r.error ?? "The test did not go through.", 502);
    }
    if (!i.leadSheetId) return bad("Save your Google Sheet first.");
    const r = await logLead({ businessId, callerName: "Test Lead", callerPhone: "+15555550100", callerEmail: "test@example.com", reason: "Test row from your AI Receptionist dashboard.", callTimestampISO: when }, i.leadSheetId, i.leadSheetTabName);
    return r.success ? { status: 200, json: { success: true } } : bad("We couldn't add a row. Check that the sheet is shared with our address as Editor, and that the tab name is right.", 502);
  }
  return bad("Unknown action.");
}
