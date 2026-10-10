import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { parseManualLeads } from "@/lib/growth/pure";
import { getSettings, insertManualLead } from "@/lib/growth/store";

export const runtime = "nodejs";

/** Paste a list of businesses (one per line); the daily run does the rest: email, preview, draft. */
export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { text?: string; industry?: string; city?: string };
  if (!b.text?.trim()) return NextResponse.json({ success: false, error: "Paste at least one website." }, { status: 400 });

  const { leads, rejected } = parseManualLeads(b.text, 100);
  const settings = await getSettings();
  let added = 0, updated = 0, duplicates = 0;

  for (const l of leads) {
    try {
      const r = await insertManualLead({
        host: l.host, website: l.website, name: l.name, email: l.email,
        industry: b.industry?.trim().slice(0, 120) || undefined, city: b.city?.trim().slice(0, 120) || undefined, country: settings.country,
      });
      if (r === "added") added++; else if (r === "updated") updated++; else duplicates++;
    } catch (err) {
      console.error("[growth] manual lead failed:", err);
      rejected.push({ line: l.website, reason: "Could not be saved" });
    }
  }
  return NextResponse.json({ success: true, added, updated, duplicates, rejected: rejected.slice(0, 20) });
}
