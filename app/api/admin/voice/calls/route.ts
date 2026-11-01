import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { deleteCall } from "@/lib/voice/store";

export const runtime = "nodejs";

/** Admin: remove one call from the history list (it does not change anyone's minutes). */
export async function DELETE(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  const callId = req.nextUrl.searchParams.get("callId");
  if (!callId) return NextResponse.json({ success: false, error: "Missing call id." }, { status: 400 });
  await deleteCall(callId);
  return NextResponse.json({ success: true });
}
