import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/accounts/session";
import { getStoredBusiness } from "@/lib/config/business-store";
import { createRequest, listRequests, type RequestKind } from "@/lib/requests/store";
import { normalizeE164 } from "@/lib/voice/pure";
import { sendFounderAlert } from "@/lib/integrations/notify";
import { rateLimit } from "@/lib/security/rate-limit";
import { siteConfig } from "@/lib/site-config";

export const runtime = "nodejs";

const cap = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
const PLATFORMS = ["WordPress", "Wix", "Squarespace", "Shopify", "Webflow", "GoDaddy", "Other / not sure"];

/** Client asks for a phone number or for the website chat to be installed. You see it in /admin and get an email. */
export async function POST(req: NextRequest) {
  const session = await getClientSession();
  if (!session?.businessId) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  const businessId = session.businessId;
  const stored = await getStoredBusiness(businessId);
  if (!stored) return NextResponse.json({ success: false, error: "Unknown business." }, { status: 404 });
  if ((await rateLimit(`request:${businessId}`, 6, 86400)).limited) return NextResponse.json({ success: false, error: "You've sent several requests today. We'll be in touch soon." }, { status: 429 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const kind = b.kind === "phone" || b.kind === "chat_install" ? (b.kind as RequestKind) : null;
  if (!kind) return NextResponse.json({ success: false, error: "Unknown request." }, { status: 400 });
  if (b.consent !== true) return NextResponse.json({ success: false, error: "Please tick the box to give us permission to set this up." }, { status: 400 });

  let details: Record<string, unknown>;
  if (kind === "phone") {
    const mode = b.mode === "keep" ? "keep" : "new";
    const areaCode = cap(b.areaCode, 3);
    if (areaCode && !/^\d{3}$/.test(areaCode)) return NextResponse.json({ success: false, error: "The area code is 3 digits, like 512." }, { status: 400 });
    const current = cap(b.currentNumber, 25);
    const currentNumber = current ? normalizeE164(current) : undefined;
    if (current && !currentNumber) return NextResponse.json({ success: false, error: "That current number doesn't look right. Include the area code." }, { status: 400 });
    if (mode === "keep" && !currentNumber) return NextResponse.json({ success: false, error: "Enter the business number you want to keep." }, { status: 400 });
    details = { mode, areaCode: areaCode || null, currentNumber: currentNumber ?? null, note: cap(b.note, 500) };
  } else {
    const website = cap(b.websiteUrl, 300);
    try { const u = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`); if (!u.hostname.includes(".")) throw new Error("x"); } catch { return NextResponse.json({ success: false, error: "Enter your website address, like www.yourbusiness.com." }, { status: 400 }); }
    const platform = PLATFORMS.find((p) => p === b.platform) ?? "Other / not sure";
    details = { websiteUrl: website, platform, note: cap(b.note, 500) };
  }

  const open = await listRequests({ businessId, status: "pending" });
  if (open.some((r) => r.kind === kind)) return NextResponse.json({ success: true, already: true });

  await createRequest(kind, businessId, session.email, details);
  const origin = siteConfig.brand.baseUrl.replace(/\/+$/, "");
  await sendFounderAlert(kind === "phone" ? `Phone number request: ${stored.config.name}` : `Chat install request: ${stored.config.name}`, [
    `${stored.config.name} (${session.email}) gave permission for you to set this up:`,
    ...Object.entries(details).filter(([, v]) => v).map(([k, v]) => `${k}: ${String(v)}`),
    `Open it: ${origin}/admin/clients/${businessId}/edit#${kind === "phone" ? "phone" : "chatcode"}`,
  ]).catch(() => undefined);
  return NextResponse.json({ success: true });
}
