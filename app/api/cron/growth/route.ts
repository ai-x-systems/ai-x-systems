import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { runGrowth } from "@/lib/growth/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (
    !secret ||
    provided.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  ) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const result = await runGrowth();
  return NextResponse.json({ success: true, result });
}
