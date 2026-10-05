import { NextRequest, NextResponse } from "next/server";
import { createProspect, ServiceType } from "@/lib/leads/prospects";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";
import { sendFounderAlert, sendProspectAutoReply } from "@/lib/integrations/notify";
import { runInBackground } from "@/lib/utils/background";
import { markOutreachReplied } from "@/lib/growth/store";
import { siteConfig } from "@/lib/site-config";

export const runtime = "nodejs";

const VALID_SERVICE_TYPES: ServiceType[] = ["voice", "chatbot", "both"];

export async function POST(req: NextRequest) {
  if ((await rateLimit(`prospects:${clientIp(req)}`, 5, 3600)).limited) {
    return NextResponse.json(
      { success: false, error: "Too many submissions. Please try again later." },
      { status: 429 }
    );
  }

  let body: {
    hp?: string;
    businessName?: string;
    industry?: string;
    country?: string;
    city?: string;
    serviceType?: string;
    contactName?: string;
    email?: string;
    phone?: string;
    website?: string;
    businessHours?: string;
    offerings?: string;
    challenges?: string;
    volume?: string;
    referralSource?: string;
    details?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  // Bots fill the hidden field. Pretend success so they don't retry.
  if (body.hp) return NextResponse.json({ success: true });

  if (
    !body.businessName?.trim() ||
    !body.contactName?.trim() ||
    !body.email?.trim() ||
    !body.country?.trim() ||
    !body.serviceType
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Business name, contact name, email, country, and which service you want are required.",
      },
      { status: 400 }
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    return NextResponse.json({ success: false, error: "Enter a valid email address." }, { status: 400 });
  }
  if (!VALID_SERVICE_TYPES.includes(body.serviceType as ServiceType)) {
    return NextResponse.json(
      { success: false, error: `serviceType must be one of: ${VALID_SERVICE_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const cap = (v: string | undefined, n: number) => v?.trim().slice(0, n) || undefined;

  try {
    await createProspect({
      businessName: body.businessName.trim().slice(0, 200),
      industry: cap(body.industry, 120),
      country: body.country.trim(),
      city: cap(body.city, 120),
      serviceType: body.serviceType as ServiceType,
      contactName: body.contactName.trim().slice(0, 120),
      email: body.email.trim().toLowerCase(),
      phone: cap(body.phone, 40),
      website: cap(body.website, 200),
      businessHours: cap(body.businessHours, 300),
      offerings: cap(body.offerings, 1000),
      challenges: cap(body.challenges, 1000),
      volume: cap(body.volume, 120),
      referralSource: cap(body.referralSource, 200),
      details: cap(body.details, 2000),
    });
  } catch (err) {
    console.error("[prospects] failed to save:", err);
    return NextResponse.json(
      { success: false, error: "Something went wrong submitting your info. Please try again." },
      { status: 500 }
    );
  }

  const email = body.email.trim().toLowerCase();
  const businessName = body.businessName.trim().slice(0, 200);
  const contactName = body.contactName.trim().slice(0, 120);

  // Speed-to-lead: tell the founder immediately, acknowledge the prospect
  // immediately, and stop any outbound sequence to this address.
  runInBackground(async () => {
    await sendFounderAlert(`New demo request: ${businessName}`, [
      `${contactName} (${email}) from ${businessName} asked for: ${body.serviceType}.`,
      `${[body.industry, body.city, body.country].filter(Boolean).join(" · ")}`,
      `Challenges: ${cap(body.challenges, 500) ?? "-"}`,
      `Open ${siteConfig.brand.baseUrl}/admin/inquiries`,
    ]);
    await sendProspectAutoReply({
      toEmail: email,
      contactName,
      businessName,
      tryUrl: `${siteConfig.brand.baseUrl}/`,
    });
    await markOutreachReplied(email, "demo_booked");
  });

  return NextResponse.json({ success: true });
}
