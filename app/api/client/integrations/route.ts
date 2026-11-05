import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/accounts/session";
import { runIntegrationsAction } from "@/lib/config/integrations-actions";

export const runtime = "nodejs";

/** Client: save where their leads go (alert email, CRM/automation webhook, Google Sheet) and send test leads. */
export async function POST(req: NextRequest) {
  const session = await getClientSession();
  if (!session?.businessId) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const r = await runIntegrationsAction(session.businessId, body);
  return NextResponse.json(r.json, { status: r.status });
}
