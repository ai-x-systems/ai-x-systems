import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { runGrowth, ALL_TASKS, type GrowthTask } from "@/lib/growth/pipeline";
import { redraftUnsent } from "@/lib/growth/draft";
import { getSettings } from "@/lib/growth/store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { task?: string };
  if (body.task === "redraft") return NextResponse.json({ success: true, result: { redraft: await redraftUnsent(await getSettings()) } });
  const tasks = body.task === "all" || !body.task ? ALL_TASKS : ALL_TASKS.filter((t) => t === body.task);
  if (tasks.length === 0) return NextResponse.json({ success: false, error: "Unknown task." }, { status: 400 });
  return NextResponse.json({ success: true, result: await runGrowth(tasks as GrowthTask[]) });
}
