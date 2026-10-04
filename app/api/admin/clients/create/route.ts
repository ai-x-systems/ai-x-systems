import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { accountStore } from "@/lib/accounts/store";
import { hashPassword } from "@/lib/accounts/password";
import { getBusiness } from "@/lib/config/business-store";

export const runtime = "nodejs";

/**
 * Deliberately not lib/accounts/session.ts's signUp() — that function
 * also starts a session cookie for the new account, which here would
 * wrongly log the admin's browser in as the client they just created.
 * This route only inserts the account row.
 */
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  }

  let body: { email?: string; password?: string; businessId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const { password, businessId } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ success: false, error: "Enter a valid email address." }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { success: false, error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }
  if (!businessId || !(await getBusiness(businessId))) {
    return NextResponse.json(
      { success: false, error: "Unknown businessId — no matching business configuration." },
      { status: 400 }
    );
  }

  const existing = await accountStore.findByEmail(email);
  if (existing) {
    return NextResponse.json(
      { success: false, error: "An account with this email already exists." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const account = await accountStore.create({ email, passwordHash, role: "client", businessId });

  return NextResponse.json({ success: true, accountId: account.id });
}
