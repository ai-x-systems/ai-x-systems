import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/accounts/session";
import { siteConfig } from "@/lib/site-config";
import { createWhopCheckout, whopConfigured } from "@/lib/billing/whop-checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Signed-in client clicks "Buy 200 / 500 minutes": we create a Whop checkout tagged with THEIR
 * client id and send them to it. After payment, the webhook adds the minutes automatically.
 */
export async function GET(req: NextRequest) {
  const base = siteConfig.brand.baseUrl.replace(/\/+$/, "");
  const session = await getClientSession();
  if (!session?.businessId) return NextResponse.redirect(`${base}/client/login`);
  if (!whopConfigured()) return NextResponse.redirect(`${base}/dashboard`);

  const pack = req.nextUrl.searchParams.get("pack");
  const planKey = pack === "500" ? "minutes500" : pack === "200" ? "minutes200" : null;
  if (!planKey) return NextResponse.redirect(`${base}/dashboard`);

  try {
    const { url } = await createWhopCheckout({ planKey, businessId: session.businessId, redirectUrl: `${base}/dashboard?paid=1` });
    return NextResponse.redirect(url);
  } catch (err) {
    console.error("[whop] client checkout failed:", err);
    return NextResponse.redirect(`${base}/dashboard?payment=unavailable`);
  }
}
