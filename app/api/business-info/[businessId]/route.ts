import { NextRequest, NextResponse } from "next/server";
import { getBusiness } from "@/lib/config/business-store";

export const runtime = "nodejs";

/**
 * Public, unauthenticated, deliberately tiny: just enough for the chat
 * widget/embed page to display a business's name without exposing
 * anything else from its config (no integrations, no knowledge base
 * contents, nothing sensitive) — this business's name is already visible
 * on their own public website, so there's nothing new being exposed here.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await context.params;
  const business = await getBusiness(businessId);

  if (!business) {
    return NextResponse.json({ success: false, error: "Unknown business." }, { status: 404 });
  }

  return NextResponse.json({ success: true, name: business.name });
}
