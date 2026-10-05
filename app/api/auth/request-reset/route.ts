import { NextRequest, NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/accounts/reset";
import { AccountRole } from "@/types/account";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { email?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.email || (body.role !== "admin" && body.role !== "client")) {
    return NextResponse.json(
      { success: false, error: "email and a valid role are required." },
      { status: 400 }
    );
  }

  // Stops the form being used to email-bomb someone with reset links.
  const email = body.email.trim().toLowerCase();
  const [perEmail, perIp] = await Promise.all([
    rateLimit(`reset:${email}`, 3, 3600),
    rateLimit(`reset-ip:${clientIp(req)}`, 10, 3600),
  ]);
  if (perEmail.limited || perIp.limited) {
    // Same shape as success so the limiter can't be used to probe accounts.
    return NextResponse.json({ success: true });
  }

  const result = await requestPasswordReset(body.email, body.role as AccountRole);
  return NextResponse.json(result);
}
