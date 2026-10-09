import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { accountStore } from "@/lib/accounts/store";
import { getSupabaseClient } from "@/lib/supabase/client";
import { draftFromWebsite } from "@/lib/onboarding/from-website";
import { intakeExpiry, newIntakeToken, INTAKE_TTL_DAYS } from "@/lib/onboarding/intake-token";
import { isServices } from "@/lib/onboarding/build-config";
import { isSafePublicUrl } from "@/lib/growth/pure";
import { siteConfig } from "@/lib/site-config";

export const runtime = "nodejs";
export const maxDuration = 60;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Creates a private, expiring link the CLIENT opens to finish their own setup.
 * The client's email here is their login AND the email their payment must come from.
 */
export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { businessName?: string; clientEmail?: string; services?: string; website?: string; paid?: boolean };

  const name = b.businessName?.trim();
  const email = b.clientEmail?.trim().toLowerCase();
  if (!name) return NextResponse.json({ success: false, error: "Business name is required." }, { status: 400 });
  if (!email || !EMAIL.test(email)) return NextResponse.json({ success: false, error: "A valid client email is required." }, { status: 400 });
  if (!isServices(b.services)) return NextResponse.json({ success: false, error: "Choose chat, voice or both." }, { status: 400 });
  if (await accountStore.findByEmail(email)) return NextResponse.json({ success: false, error: "A login with that email already exists." }, { status: 409 });

  // Pre-fill from their website when we can; the client reviews everything anyway.
  let draft: Record<string, unknown> = {};
  let drafted = false;
  const site = b.website?.trim() ? isSafePublicUrl(b.website.trim()) : null;
  if (b.website?.trim() && !site) return NextResponse.json({ success: false, error: "That website address isn't valid." }, { status: 400 });
  if (site) {
    const r = await draftFromWebsite(site.toString()).catch(() => ({ draft: undefined }));
    if (r.draft) { draft = r.draft as Record<string, unknown>; drafted = true; }
  }

  const { token, hash } = newIntakeToken();
  const { error } = await getSupabaseClient().from("client_intakes").insert({
    token_hash: hash, business_name: name.slice(0, 120), client_email: email, services: b.services,
    website: site?.toString() ?? null, draft, paid: b.paid === true, expires_at: intakeExpiry(),
  });
  if (error) {
    console.error("[intake] create failed:", error);
    return NextResponse.json({ success: false, error: "Could not create the link." }, { status: 500 });
  }

  const origin = siteConfig.brand.baseUrl.replace(/\/+$/, "");
  return NextResponse.json({ success: true, link: `${origin}/start/${token}`, expiresInDays: INTAKE_TTL_DAYS, prefilled: drafted });
}
