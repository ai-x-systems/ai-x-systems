import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { getGoogleAccessToken } from "@/lib/integrations/google-auth";

export const runtime = "nodejs";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

/**
 * Diagnostic only, admin-gated. Fetches a Sheet's own metadata (its title
 * and the exact, real names of every tab inside it) using the same
 * service-account auth path lib/integrations/sheets.ts uses — but a GET
 * on spreadsheets.get instead of an append. If this itself 404s, the
 * problem is the spreadsheetId or access grant, full stop. If it succeeds
 * but the returned tab names don't exactly match what
 * lib/integrations/sheets.ts is appending to (default "Sheet1"), that
 * mismatch — often invisible in a screenshot (trailing space, different
 * case, a lookalike character) — is the actual bug.
 *
 * Usage: GET /api/admin/debug-sheet-access?sheetId=<id>, while logged in
 * as admin.
 */
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  }

  const sheetId = req.nextUrl.searchParams.get("sheetId");
  if (!sheetId) {
    return NextResponse.json({ success: false, error: "Pass ?sheetId=<id> in the URL." }, { status: 400 });
  }

  const tokenResult = await getGoogleAccessToken(SHEETS_SCOPE);
  if ("error" in tokenResult) {
    return NextResponse.json({ success: false, error: `Auth failed: ${tokenResult.error}` });
  }

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}` +
    `?fields=properties.title,sheets.properties.title,sheets.properties.sheetId`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${tokenResult.token}` },
  });

  const bodyText = await res.text();

  return NextResponse.json({
    requestedSheetId: sheetId,
    httpStatus: res.status,
    googleResponse: (() => {
      try {
        return JSON.parse(bodyText);
      } catch {
        return bodyText;
      }
    })(),
  });
}
