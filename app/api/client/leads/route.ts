import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/accounts/session";
import { listRecentActivity } from "@/lib/activity/log";

export const runtime = "nodejs";

// Spreadsheet apps execute cells starting with = + - @ as formulas; a
// visitor-typed name like "=HYPERLINK(...)" must not run in the client's Excel.
function cell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET() {
  const session = await getClientSession();
  if (!session?.businessId) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });

  const rows = await listRecentActivity(session.businessId, 2000);
  const header = ["Date", "Type", "Name", "Email", "Phone", "Service", "Notes", "Test data"];
  const lines = rows.map((r) => {
    const d = r.data as Record<string, unknown>;
    return [
      r.createdAtISO, r.type, d.callerName, d.callerEmail, d.callerPhone,
      d.serviceInterest ?? d.serviceName, d.reason ?? d.startTimeISO, d.demo ? "yes" : "",
    ].map(cell).join(",");
  });

  return new Response([header.map(cell).join(","), ...lines].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${session.businessId}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
