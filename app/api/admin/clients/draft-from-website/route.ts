import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { draftFromWebsite } from "@/lib/onboarding/from-website";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  if (!url) return NextResponse.json({ success: false, error: "url is required." }, { status: 400 });
  const r = await draftFromWebsite(url);
  return r.draft ? NextResponse.json({ success: true, draft: r.draft }) : NextResponse.json({ success: false, error: r.error }, { status: 422 });
}
