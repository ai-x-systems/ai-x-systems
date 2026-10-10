import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { accountStore } from "@/lib/accounts/store";
import { hashPassword } from "@/lib/accounts/password";
import { getSupabaseClient } from "@/lib/supabase/client";
import { businessIdTaken, deleteBusinessRow, installSnippet, saveNewBusiness, type Services } from "@/lib/config/business-store";
import { buildBusinessConfig, HoursError, slugify, type OnboardInput } from "@/lib/onboarding/build-config";
import { hashIntakeToken, intakeIsUsable, looksLikeIntakeToken } from "@/lib/onboarding/intake-token";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";
import { sendEmailTo, sendFounderAlert } from "@/lib/integrations/notify";
import { siteConfig } from "@/lib/site-config";

export const runtime = "nodejs";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cap = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

/**
 * Public (no login): the client finishes their own setup with the private link.
 * Possession of the link is the credential, so: unguessable token, only its
 * hash stored, expiry, one-time use, rate limit, and the login email is fixed
 * by YOU (the client can't change who the account belongs to).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!looksLikeIntakeToken(token)) return NextResponse.json({ success: false, error: "This link isn't valid." }, { status: 404 });
  if ((await rateLimit(`intake:${clientIp(req)}`, 20, 3600)).limited) {
    return NextResponse.json({ success: false, error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ success: false, error: "Bad request." }, { status: 400 });

  const password = typeof b.password === "string" ? b.password : "";
  const notifyEmail = cap(b.notifyEmail, 200);
  if (password.length < 10 || password.length > 200) return NextResponse.json({ success: false, error: "Choose a password of at least 10 characters." }, { status: 400 });
  if (!EMAIL.test(notifyEmail)) return NextResponse.json({ success: false, error: "Enter the email where you want to receive new enquiries." }, { status: 400 });
  if (!cap(b.industry, 120)) return NextResponse.json({ success: false, error: "Tell us what kind of business this is." }, { status: 400 });

  const db = getSupabaseClient();
  const { data: row } = await db.from("client_intakes").select("*").eq("token_hash", hashIntakeToken(token)).maybeSingle();
  if (!intakeIsUsable(row)) return NextResponse.json({ success: false, error: "This link has expired or was already used. Ask us for a new one." }, { status: 410 });

  // One-time use: only one request can flip pending -> completed.
  const { data: claimed } = await db.from("client_intakes").update({ status: "completed" }).eq("id", row.id).eq("status", "pending").select("id");
  if (!claimed?.length) return NextResponse.json({ success: false, error: "This link was already used." }, { status: 409 });

  let createdId: string | undefined;
  try {
    if (await accountStore.findByEmail(row.client_email)) throw new Error("account-exists");
    let id = slugify(row.business_name);
    for (let n = 2; await businessIdTaken(id); n++) id = `${slugify(row.business_name)}-${n}`;

    const input: OnboardInput = {
      name: row.business_name, industry: cap(b.industry, 120), website: cap(b.website, 200) || row.website || undefined,
      phone: cap(b.phone, 40), address: cap(b.address, 200), notifyEmail, contactEmail: notifyEmail,
      hoursText: cap(b.hoursText, 800), servicesText: cap(b.servicesText, 4000), faqsText: cap(b.faqsText, 6000),
      policiesText: cap(b.policiesText, 2000), webhookUrl: cap(b.webhookUrl, 300),
    };
    const config = buildBusinessConfig(input, id);
    const services = row.services as Services;
    await saveNewBusiness(config, row.client_email, { services, source: "intake", billingStatus: row.paid ? "active" : "awaiting_payment" });
    createdId = id;
    await accountStore.create({ email: row.client_email, passwordHash: await hashPassword(password), role: "client", businessId: id });
    await db.from("client_intakes").update({ business_id: id }).eq("id", row.id);

    const origin = siteConfig.brand.baseUrl.replace(/\/+$/, "");
    const snippet = installSnippet(origin, id);
    const loginUrl = `${origin}/client/login`;

    // Confirmation to the client (login URL + install line; never the password) and a heads-up to you.
    await sendEmailTo(row.client_email, "Your AI receptionist is set up", [
      `Hi, your setup for ${row.business_name} is saved.`,
      `Log in any time at ${loginUrl} with this email address and the password you chose.`,
      services !== "voice" ? `To put the chat assistant on your website, add this line before the closing body tag: ${snippet}` : "We'll be in touch shortly with your phone number and how to forward your calls.",
    ]).catch(() => undefined);
    await sendFounderAlert(`Intake completed: ${row.business_name}`, [
      `${row.business_name} (${row.client_email}) finished their setup. Services: ${services}.`,
      row.paid ? "Marked as paid." : "Not marked as paid yet: check payment and set Billing to active in /admin.",
      services !== "chat" ? "They need a phone number: attach one in /admin/voice and add minutes." : "Nothing else needed from you.",
      `${origin}/admin`,
    ]).catch(() => undefined);

    return NextResponse.json({ success: true, businessId: id, services, snippet: services === "voice" ? null : snippet, loginUrl });
  } catch (err) {
    // Release the link so the client can fix whatever failed and try again, and drop any half-made business.
    if (createdId) await deleteBusinessRow(createdId).catch(() => undefined);
    await db.from("client_intakes").update({ status: "pending" }).eq("id", row.id);
    if (err instanceof HoursError) return NextResponse.json({ success: false, error: err.message }, { status: 400 });
    if (err instanceof ZodError) return NextResponse.json({ success: false, error: "Some details look invalid. Please check them and try again." }, { status: 400 });
    if (err instanceof Error && err.message === "account-exists") return NextResponse.json({ success: false, error: "An account already exists for this email. Please contact us." }, { status: 409 });
    console.error("[intake] failed:", err);
    return NextResponse.json({ success: false, error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
