import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { getSettings, saveSettings } from "@/lib/growth/store";

export const runtime = "nodejs";

const list = (v: unknown, max: number) =>
  (Array.isArray(v) ? v : String(v ?? "").split(/[\n,]/)).map((x) => String(x).trim()).filter(Boolean).slice(0, max);

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const cur = await getSettings();
  await saveSettings({
    autoSend: typeof b.autoSend === "boolean" ? b.autoSend : cur.autoSend,
    dailySendCap: Math.min(200, Math.max(1, Number(b.dailySendCap) || cur.dailySendCap)),
    industries: b.industries !== undefined ? list(b.industries, 20) : cur.industries,
    cities: b.cities !== undefined ? list(b.cities, 50) : cur.cities,
    country: typeof b.country === "string" && b.country.trim() ? b.country.trim().slice(0, 2).toUpperCase() : cur.country,
    offer: b.offer === "voice" || b.offer === "chat" ? b.offer : cur.offer,
    senderName: typeof b.senderName === "string" && b.senderName.trim() ? b.senderName.trim().slice(0, 40) : cur.senderName,
    discoverPerRun: Math.min(20, Math.max(1, Number(b.discoverPerRun) || cur.discoverPerRun)),
  });
  return NextResponse.json({ success: true });
}
