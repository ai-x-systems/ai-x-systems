import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { getBusiness } from "@/lib/config/business-store";
import { getBusinessOverride, saveBusinessOverride } from "@/lib/config/overrides";

export const runtime = "nodejs";

export async function GET(req: NextRequest, context: { params: Promise<{ businessId: string }> }) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  }

  const { businessId } = await context.params;
  const business = await getBusiness(businessId);
  if (!business) {
    return NextResponse.json({ success: false, error: "Unknown business." }, { status: 404 });
  }

  const override = await getBusinessOverride(businessId);

  return NextResponse.json({
    success: true,
    businessName: business.name,
    faqs: override?.faqs ?? business.knowledge.faqs,
    notifyEmail: override?.notifyEmail ?? business.integrations.notifyEmail ?? "",
  });
}

export async function POST(req: NextRequest, context: { params: Promise<{ businessId: string }> }) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  }

  const { businessId } = await context.params;
  if (!(await getBusiness(businessId))) {
    return NextResponse.json({ success: false, error: "Unknown business." }, { status: 404 });
  }

  let body: { faqs?: { question: string; answer: string }[]; notifyEmail?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const faqs = Array.isArray(body.faqs)
    ? body.faqs.filter((f) => f.question?.trim() && f.answer?.trim())
    : undefined;

  await saveBusinessOverride(businessId, {
    faqs,
    notifyEmail: body.notifyEmail?.trim() || undefined,
  });

  return NextResponse.json({ success: true });
}
