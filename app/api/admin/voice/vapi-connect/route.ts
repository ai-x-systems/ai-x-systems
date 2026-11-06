import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { getLineForBusiness } from "@/lib/voice/store";
import { connectNumberToWebhook } from "@/lib/voice/vapi-api";

export const runtime = "nodejs";

/** Admin: point this client's Vapi number at your webhook through Vapi's API (no dashboard clicking). */
export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { businessId?: string };
  const line = b.businessId ? await getLineForBusiness(b.businessId) : null;
  if (!line) return NextResponse.json({ success: false, error: "Attach a phone line to this client first." }, { status: 404 });
  if (!line.vapiPhoneNumberId) return NextResponse.json({ success: false, error: "Add the Vapi phone number id to the line first (open the number in Vapi and copy its id)." }, { status: 400 });
  const r = await connectNumberToWebhook(line.vapiPhoneNumberId);
  if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: 502 });
  return NextResponse.json({
    success: true,
    warning: r.assistantAttached ? "This number still has an assistant attached in Vapi. Open the number in Vapi and clear the Assistant field, otherwise calls won't use your system." : undefined,
    serverUrlSet: r.serverUrlSet,
  });
}
