import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/accounts/session";
import { accountStore } from "@/lib/accounts/store";
import { hashPassword, verifyPassword } from "@/lib/accounts/password";
import { getStoredBusiness, setBusinessFlags, updateBusinessConfig } from "@/lib/config/business-store";
import { sendFounderAlert } from "@/lib/integrations/notify";
import { rateLimit } from "@/lib/security/rate-limit";
import { siteConfig } from "@/lib/site-config";

export const runtime = "nodejs";

const cap = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

/** Client: business details, pause/resume the assistant, change password, ask for account deletion. */
export async function POST(req: NextRequest) {
  const session = await getClientSession();
  if (!session?.businessId) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  const businessId = session.businessId;
  const stored = await getStoredBusiness(businessId);
  if (!stored || stored.source !== "db") return NextResponse.json({ success: false, error: "These settings can't be changed from here. Please contact us." }, { status: 400 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  switch (b.action) {
    case "profile": {
      const name = cap(b.name, 120);
      if (!name) return NextResponse.json({ success: false, error: "Your business needs a name." }, { status: 400 });
      const r = await updateBusinessConfig(businessId, (c) => ({
        ...c,
        name,
        phoneNumber: cap(b.phone, 40) || c.phoneNumber,
        contact: { ...c.contact, address: cap(b.address, 200) || undefined, website: cap(b.website, 200) || undefined },
      }));
      return r.ok ? NextResponse.json({ success: true }) : NextResponse.json({ success: false, error: r.error }, { status: 400 });
    }
    case "pause":
    case "resume": {
      await setBusinessFlags(businessId, { active: b.action === "resume" });
      return NextResponse.json({ success: true });
    }
    case "password": {
      if ((await rateLimit(`pw:${session.id}`, 8, 3600)).limited) return NextResponse.json({ success: false, error: "Too many attempts. Try again later." }, { status: 429 });
      const current = typeof b.current === "string" ? b.current : "";
      const next = typeof b.next === "string" ? b.next : "";
      if (next.length < 10 || next.length > 200) return NextResponse.json({ success: false, error: "Choose a new password of at least 10 characters." }, { status: 400 });
      const account = await accountStore.findById(session.id);
      if (!account || !(await verifyPassword(current, account.passwordHash))) return NextResponse.json({ success: false, error: "Your current password isn't right." }, { status: 400 });
      await accountStore.updatePassword(account.id, await hashPassword(next));
      return NextResponse.json({ success: true });
    }
    case "change_request": {
      if ((await rateLimit(`chg:${businessId}`, 10, 86400)).limited) return NextResponse.json({ success: false, error: "You've sent a lot of requests today. We'll get to them soon." }, { status: 429 });
      const message = cap(b.message, 2000);
      if (message.length < 5) return NextResponse.json({ success: false, error: "Tell us what you'd like changed." }, { status: 400 });
      const origin = siteConfig.brand.baseUrl.replace(/\/+$/, "");
      await sendFounderAlert(`Change request: ${stored.config.name}`, [`${stored.config.name} (${session.email}) asked for a change:`, message, `${origin}/admin/clients/${businessId}/edit`]).catch(() => undefined);
      return NextResponse.json({ success: true });
    }
    case "delete_request": {
      if ((await rateLimit(`delreq:${businessId}`, 3, 86400)).limited) return NextResponse.json({ success: true });
      const origin = siteConfig.brand.baseUrl.replace(/\/+$/, "");
      await sendFounderAlert(`Account deletion requested: ${stored.config.name}`, [
        `${stored.config.name} (${session.email}) asked to delete their account and data.`,
        stored.billingStatus === "active" ? "Their subscription is still ACTIVE: end it in Sales first, then delete them in Clients." : "No active subscription.",
        `${origin}/admin`,
      ]).catch(() => undefined);
      return NextResponse.json({ success: true });
    }
    default:
      return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
  }
}
