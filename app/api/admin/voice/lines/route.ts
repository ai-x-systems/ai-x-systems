import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { getBusiness } from "@/lib/config/business-store";
import { upsertLine } from "@/lib/voice/store";
import { getSupabaseClient } from "@/lib/supabase/client";
import { normalizeE164, normalizeLineAddress } from "@/lib/voice/pure";

export const runtime = "nodejs";

/** Attach (or update) the phone number a client's callers reach. One line per business. */
export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as {
    businessId?: string; number?: string; vapiPhoneNumberId?: string; forwardTo?: string; sellCentsPerMinute?: number; enabled?: boolean;
  };

  if (!b.businessId || !(await getBusiness(b.businessId))) return NextResponse.json({ success: false, error: "Unknown business id." }, { status: 404 });
  const e164 = normalizeLineAddress(b.number);
  if (!e164) return NextResponse.json({ success: false, error: "Enter the phone number with area code, e.g. +15125550123 (or a SIP address like sip:name@sip.vapi.ai)." }, { status: 400 });
  const forwardTo = b.forwardTo?.trim() ? normalizeE164(b.forwardTo) : undefined;
  if (b.forwardTo?.trim() && !forwardTo) return NextResponse.json({ success: false, error: "The fallback number isn't a valid phone number." }, { status: 400 });

  try {
    await upsertLine({
      businessId: b.businessId, e164, vapiPhoneNumberId: b.vapiPhoneNumberId?.trim() || undefined, forwardTo,
      sellCentsPerMinute: Math.max(0, Math.round(Number(b.sellCentsPerMinute) || 0)), enabled: b.enabled !== false, isDemoLine: false,
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    return NextResponse.json({ success: false, error: code === "23505" ? "That number is already assigned to another client." : "Could not save the line." }, { status: code === "23505" ? 409 : 500 });
  }
  return NextResponse.json({ success: true });
}

/** Remove a phone line (the client keeps their account and minutes; callers to that number stop being answered). */
export async function DELETE(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  const businessId = req.nextUrl.searchParams.get("businessId");
  if (!businessId) return NextResponse.json({ success: false, error: "Missing client id." }, { status: 400 });
  const { error } = await getSupabaseClient().from("voice_lines").delete().eq("business_id", businessId);
  if (error) return NextResponse.json({ success: false, error: "Could not remove the line." }, { status: 500 });
  return NextResponse.json({ success: true });
}
