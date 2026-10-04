import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getAdminSession } from "@/lib/accounts/session";
import { accountStore } from "@/lib/accounts/store";
import { hashPassword } from "@/lib/accounts/password";
import { businessIdTaken, saveNewBusiness, installSnippet } from "@/lib/config/business-store";
import { buildBusinessConfig, generatePassword, slugify, type OnboardInput } from "@/lib/onboarding/build-config";
import { siteConfig } from "@/lib/site-config";

export const runtime = "nodejs";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * One call = a client is set up: business config saved to the database
 * (no Git commit), client login created, install snippet returned.
 * The client's login email is also the email their payment must come
 * from — the billing webhook matches on it.
 */
export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });

  const b = (await req.json().catch(() => null)) as (OnboardInput & { clientEmail?: string; clientPassword?: string }) | null;
  if (!b?.name?.trim()) return NextResponse.json({ success: false, error: "Business name is required." }, { status: 400 });
  if (!b.notifyEmail || !EMAIL.test(b.notifyEmail.trim())) return NextResponse.json({ success: false, error: "A valid email for lead alerts is required." }, { status: 400 });

  const clientEmail = (b.clientEmail?.trim() || b.notifyEmail.trim()).toLowerCase();
  if (!EMAIL.test(clientEmail)) return NextResponse.json({ success: false, error: "Client login email is not valid." }, { status: 400 });
  if (b.clientPassword && b.clientPassword.length < 8) return NextResponse.json({ success: false, error: "Password must be at least 8 characters." }, { status: 400 });
  if (await accountStore.findByEmail(clientEmail)) return NextResponse.json({ success: false, error: "A login with that email already exists." }, { status: 409 });

  let id = slugify(b.name);
  for (let n = 2; await businessIdTaken(id); n++) id = `${slugify(b.name)}-${n}`;

  let config;
  try {
    config = buildBusinessConfig(b, id);
  } catch (err) {
    const msg = err instanceof ZodError ? err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : "Invalid business details.";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }

  const password = b.clientPassword || generatePassword();
  await saveNewBusiness(config, clientEmail);
  await accountStore.create({ email: clientEmail, passwordHash: await hashPassword(password), role: "client", businessId: id });

  const origin = siteConfig.brand.baseUrl.replace(/\/+$/, "");
  return NextResponse.json({
    success: true,
    businessId: id,
    login: { email: clientEmail, password, url: `${origin}/client/login` },
    snippet: installSnippet(origin, id),
    hostedChatUrl: `${origin}/embed/chat/${id}`,
    checkoutUrl: process.env.FREEMIUS_CHECKOUT_URL || null,
    servicesParsed: config.knowledge.services.length,
    faqsParsed: config.knowledge.faqs.length,
  });
}
