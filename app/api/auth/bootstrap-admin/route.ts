import { NextRequest, NextResponse } from "next/server";
import { accountStore } from "@/lib/accounts/store";
import { hashPassword } from "@/lib/accounts/password";
import crypto from "crypto";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/**
 * There is no public "sign up as admin" flow — the only way to create an
 * admin account is this route, and only while no admin account exists yet
 * AND the caller knows ADMIN_BOOTSTRAP_SECRET (a separate env var from
 * SESSION_SECRET — set one, use it once, you can leave it set since this
 * route self-disables after the first admin exists).
 *
 * Usage (once, after setting ADMIN_BOOTSTRAP_SECRET in your env):
 * ```
 * curl -X POST https://<your-deployment>/api/auth/bootstrap-admin \
 *   -H "Content-Type: application/json" \
 *   -d '{"email":"you@aixsystems.app","password":"...","secret":"<ADMIN_BOOTSTRAP_SECRET>"}'
 * ```
 */
export async function POST(req: NextRequest) {
  const configuredSecret = process.env.ADMIN_BOOTSTRAP_SECRET;
  if (!configuredSecret) {
    return NextResponse.json(
      { success: false, error: "ADMIN_BOOTSTRAP_SECRET is not set." },
      { status: 500 }
    );
  }

  if ((await rateLimit(`bootstrap:${clientIp(req)}`, 5, 3600)).limited) {
    return NextResponse.json({ success: false, error: "Too many attempts." }, { status: 429 });
  }

  let body: { email?: string; password?: string; secret?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const provided = Buffer.from(String(body.secret ?? ""));
  const expected = Buffer.from(configuredSecret);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }

  const existingAdmin = (await accountStore.list()).some((a) => a.role === "admin");
  if (existingAdmin) {
    return NextResponse.json(
      { success: false, error: "An admin account already exists — this route is now disabled." },
      { status: 409 }
    );
  }

  if (!body.email || !body.password || body.password.length < 8) {
    return NextResponse.json(
      { success: false, error: "email and a password of at least 8 characters are required." },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(body.password);
  const account = await accountStore.create({
    email: body.email.trim().toLowerCase(),
    passwordHash,
    role: "admin",
  });

  return NextResponse.json({ success: true, accountId: account.id });
}
