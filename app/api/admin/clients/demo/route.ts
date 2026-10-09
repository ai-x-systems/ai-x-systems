import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { createPreviewBusiness } from "@/lib/onboarding/demo";
import { isSafePublicUrl } from "@/lib/growth/pure";
import { siteConfig } from "@/lib/site-config";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Manual preview for a prospect who just replied: paste their website, get a private link in ~15 seconds. */
export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { website?: string; name?: string; industry?: string };
  const site = b.website ? isSafePublicUrl(b.website) : null;
  if (!site) return NextResponse.json({ success: false, error: "Enter a valid public website address." }, { status: 400 });
  const name = b.name?.trim() || site.hostname.replace(/^www\./, "").split(".")[0].replace(/-/g, " ");

  const r = await createPreviewBusiness({ name: name.slice(0, 80), industry: b.industry?.trim(), website: site.toString() });
  if (!r.ok) return NextResponse.json({ success: false, error: r.message }, { status: 422 });

  const origin = siteConfig.brand.baseUrl.replace(/\/+$/, "");
  return NextResponse.json({ success: true, businessId: r.businessId, tryUrl: `${origin}/try/${r.businessId}`, name });
}
