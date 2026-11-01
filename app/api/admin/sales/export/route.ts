import { getAdminSession } from "@/lib/accounts/session";
import { loadPaymentLines } from "@/lib/billing/sales-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheet formula guard
  return `"${s.replace(/"/g, '""')}"`;
}

/** Admin: every payment as a CSV (for your records / accountant). */
export async function GET() {
  if (!(await getAdminSession())) return new Response("Admin access required.", { status: 403 });
  const lines = (await loadPaymentLines()).reverse();
  const header = ["Date", "Client", "Email", "Type", "Plan", "Amount (USD)", "Setup part", "Note", "Source"];
  const rows = lines.map((l) => [l.at, l.businessId ?? "", l.email ?? "", l.kind, l.plan ?? "", l.amount.toFixed(2), l.setup.toFixed(2), l.note, l.manual ? "manual" : "whop"].map(cell).join(","));
  return new Response([header.map(cell).join(","), ...rows].join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="sales.csv"', "Cache-Control": "no-store" },
  });
}
