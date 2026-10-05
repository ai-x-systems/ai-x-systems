import { NextRequest, NextResponse } from "next/server";
import { logIn } from "@/lib/accounts/session";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.email || !body.password) {
    return NextResponse.json(
      { success: false, error: "email and password are required." },
      { status: 400 }
    );
  }

  const ip = clientIp(req);
  // Per email+IP (blunts credential stuffing on one account) AND per IP
  // (blunts spraying many accounts from one source).
  const [perAccount, perIp] = await Promise.all([
    rateLimit(`login:${body.email.trim().toLowerCase()}:${ip}`, 5, 300),
    rateLimit(`login-ip:${ip}`, 30, 300),
  ]);
  if (perAccount.limited || perIp.limited) {
    return NextResponse.json(
      { success: false, error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }

  const result = await logIn(body.email, body.password);
  return NextResponse.json(result, { status: result.success ? 200 : 401 });
}
