import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/accounts/session";
import { getStoredBusiness } from "@/lib/config/business-store";
import { saveFaqsOverride } from "@/lib/config/overrides";

export const runtime = "nodejs";

/** Client: replace the list of questions and answers the assistant knows (chat and phone use the same list). */
export async function POST(req: NextRequest) {
  const session = await getClientSession();
  if (!session?.businessId) return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  const stored = await getStoredBusiness(session.businessId);
  if (!stored || stored.source !== "db") return NextResponse.json({ success: false, error: "These can't be changed from here." }, { status: 400 });

  const b = (await req.json().catch(() => ({}))) as { faqs?: { question?: unknown; answer?: unknown }[] };
  if (!Array.isArray(b.faqs)) return NextResponse.json({ success: false, error: "Bad request." }, { status: 400 });
  const faqs = b.faqs
    .map((f) => ({ question: typeof f.question === "string" ? f.question.trim().slice(0, 300) : "", answer: typeof f.answer === "string" ? f.answer.trim().slice(0, 1500) : "" }))
    .filter((f) => f.question && f.answer)
    .slice(0, 60);
  const ok = await saveFaqsOverride(session.businessId, faqs);
  return ok ? NextResponse.json({ success: true, count: faqs.length }) : NextResponse.json({ success: false, error: "Could not save. Please try again." }, { status: 500 });
}
