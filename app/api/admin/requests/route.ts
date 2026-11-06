import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { deleteRequest, setRequestStatus } from "@/lib/requests/store";

export const runtime = "nodejs";

/** Admin: mark a client's request done or declined. */
export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { id?: string; status?: string };
  if (!b.id || (b.status !== "done" && b.status !== "declined" && b.status !== "pending")) return NextResponse.json({ success: false, error: "Bad request." }, { status: 400 });
  await setRequestStatus(b.id, b.status);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: "Missing id." }, { status: 400 });
  await deleteRequest(id);
  return NextResponse.json({ success: true });
}
