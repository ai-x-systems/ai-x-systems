import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/accounts/session";
import { getBusiness } from "@/lib/config/business-store";
import { getBusinessOverride, saveChatOverride } from "@/lib/config/overrides";
import { sanitizeChat } from "@/lib/config/chat-settings";

export const runtime = "nodejs";

/** A signed-in client reads and edits how THEIR OWN chat looks. The business id comes from the session, never from the request. */
export async function GET() {
  const session = await getClientSession();
  if (!session?.businessId) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  const business = await getBusiness(session.businessId);
  if (!business) return NextResponse.json({ success: false, error: "Unknown business." }, { status: 404 });
  const override = await getBusinessOverride(session.businessId);
  return NextResponse.json({ success: true, chat: { ...(business.chat ?? {}), ...(override?.chat ?? {}) } });
}

export async function POST(req: NextRequest) {
  const session = await getClientSession();
  if (!session?.businessId) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  if (!(await getBusiness(session.businessId))) return NextResponse.json({ success: false, error: "Unknown business." }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });

  const r = await saveChatOverride(session.businessId, sanitizeChat(body));
  return r.ok ? NextResponse.json({ success: true }) : NextResponse.json({ success: false, error: r.error }, { status: 500 });
}
