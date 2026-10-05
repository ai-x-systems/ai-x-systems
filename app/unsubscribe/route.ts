import { NextRequest } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/growth/pure";
import { markUnsubscribed } from "@/lib/growth/store";

export const runtime = "nodejs";

const page = (title: string, body: string) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><body style="font-family:system-ui,sans-serif;max-width:28rem;margin:20vh auto;padding:0 1rem;color:#111"><h1 style="font-size:1.25rem">${title}</h1>${body}</body>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );

// GET only shows a confirm button — mail scanners prefetch links, and a
// prefetch must never unsubscribe someone by accident.
export async function GET(req: NextRequest) {
  const l = req.nextUrl.searchParams.get("l") ?? "";
  const t = req.nextUrl.searchParams.get("t") ?? "";
  if (!l || !t || !verifyUnsubscribeToken(l, t)) return page("Invalid link", "<p>This unsubscribe link is not valid.</p>");
  return page(
    "Unsubscribe",
    `<p>Stop receiving emails from AI x Systems?</p><form method="post" action="/unsubscribe?l=${encodeURIComponent(l)}&t=${encodeURIComponent(t)}"><button style="padding:.6rem 1rem;font-size:1rem;cursor:pointer">Yes, unsubscribe me</button></form>`
  );
}

// POST serves both the button above and RFC 8058 one-click from mail clients.
export async function POST(req: NextRequest) {
  const l = req.nextUrl.searchParams.get("l") ?? "";
  const t = req.nextUrl.searchParams.get("t") ?? "";
  if (!l || !t || !verifyUnsubscribeToken(l, t)) return page("Invalid link", "<p>This unsubscribe link is not valid.</p>");
  await markUnsubscribed(l);
  return page("You're unsubscribed", "<p>You won't receive any more emails from us. Sorry to have bothered you.</p>");
}
