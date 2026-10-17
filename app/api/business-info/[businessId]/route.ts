import { NextRequest, NextResponse } from "next/server";
import { getBusiness } from "@/lib/config/business-store";
import { getEffectiveBusinessConfig } from "@/lib/config/overrides";
import {
  resolveBubble,
  resolveChatGreeting,
  resolveHeadline,
  resolveSubtitle,
  resolveSuggestions,
} from "@/lib/config/greetings";
import { resolveBrand } from "@/lib/config/brand";

export const runtime = "nodejs";

// The chat widget runs on the CLIENT's own website, a different origin from this app, so without
// this header the browser would block it from reading the name, colour and greeting. The data is
// public by design (it is shown to every visitor), so any origin may read it.
const CORS = { "Access-Control-Allow-Origin": "*" };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Max-Age": "86400" } });
}

/**
 * Public, unauthenticated, deliberately small: just what the chat widget and the chat window
 * need to look and sound like the business (name, greeting, headline, brand colour). Nothing
 * from integrations or the knowledge base is exposed; all of this text is shown to every
 * visitor of the chat anyway.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await context.params;
  const business = await getBusiness(businessId);

  if (!business) {
    return NextResponse.json({ success: false, error: "Unknown business." }, { status: 404, headers: CORS });
  }

  // Owner edits (colour, headline, greeting...) live in overrides; apply them on top of the base config.
  const eff = await getEffectiveBusinessConfig(business);

  return NextResponse.json(
    {
      success: true,
      name: eff.name,
      assistantName: eff.voice.assistantName,
      greeting: resolveChatGreeting(eff),
      bubble: resolveBubble(eff),
      headline: resolveHeadline(eff),
      subtitle: resolveSubtitle(eff),
      suggestions: resolveSuggestions(eff),
      brand: resolveBrand(eff),
    },
    // Public, tiny and not sensitive: a short cache keeps widget loads fast, and an owner's edit shows within a minute.
    { headers: { ...CORS, "Cache-Control": "public, max-age=20, s-maxage=20, stale-while-revalidate=60" } }
  );
}
