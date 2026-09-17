import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";

export const runtime = "nodejs";

/**
 * Diagnostic only, admin-gated. Reveals ONLY the client_email parsed out
 * of GOOGLE_SERVICE_ACCOUNT_JSON — never the private key or any other
 * field — so you can compare it against exactly who you've shared a
 * Calendar/Sheet with, without needing to paste the raw secret anywhere
 * to inspect it. A mismatch here (this email isn't the one shown in your
 * Sheet's Share dialog) is the single most common cause of a Sheets/
 * Calendar API call returning 404 despite valid-looking credentials —
 * Google's API returns "not found" rather than "forbidden" when the
 * authenticated identity lacks access, to avoid confirming the resource
 * exists to an unauthorized caller.
 */
export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  }

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    return NextResponse.json({ success: false, error: "GOOGLE_SERVICE_ACCOUNT_JSON is not set." });
  }

  try {
    const parsed = JSON.parse(raw);
    return NextResponse.json({
      success: true,
      clientEmail: parsed.client_email ?? null,
      projectId: parsed.project_id ?? null,
    });
  } catch {
    return NextResponse.json({
      success: false,
      error: "GOOGLE_SERVICE_ACCOUNT_JSON is set but is not valid JSON.",
    });
  }
}
