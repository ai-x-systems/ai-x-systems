import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * DISABLED on purpose. This route used to let ANY visitor create a client
 * account for ANY businessId and then read that business's leads, caller
 * names and credit history in /dashboard. Client logins are now created
 * only by an admin (POST /api/admin/clients/create, or the "Create client
 * login" form in /admin).
 */
export async function POST() {
  return NextResponse.json(
    { success: false, error: "Sign-up is by invitation only. Contact us and we will set up your login." },
    { status: 403 }
  );
}
