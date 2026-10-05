import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { accountStore } from "@/lib/accounts/store";
import { hashPassword, verifyPassword } from "@/lib/accounts/password";
import { Account, AccountRole, toPublicAccount, AccountPublic } from "@/types/account";

/**
 * lib/accounts/session.ts
 * ---------------------------------------------------------------------
 * Two separate cookies, one per role (aixs_admin_session /
 * aixs_client_session), instead of one shared cookie. This means logging
 * in as the client in one tab no longer overwrites the admin session in
 * another tab of the same browser — each role's cookie is independent,
 * so both can be logged in at once in one browser with no Incognito
 * window required.
 *
 * Requires a SESSION_SECRET env var — a long random string, e.g.
 * `openssl rand -hex 32`.
 * ---------------------------------------------------------------------
 */

const COOKIE_NAMES: Record<AccountRole, string> = {
  admin: "aixs_admin_session",
  client: "aixs_client_session",
};
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET is not set. Generate one (e.g. `openssl rand -hex 32`) and set it as an env var before using sign-in."
    );
  }
  return secret;
}

/**
 * Token = <accountId>.<expiresAtEpochSec>.<hmac>. The HMAC covers the id,
 * the expiry AND a fingerprint of the account's current password hash, so:
 *  - a stolen cookie stops working at its expiry (previously: never), and
 *  - changing/resetting the password instantly invalidates every session.
 */
function passwordFingerprint(passwordHash: string): string {
  return crypto.createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
}

function mac(accountId: string, exp: number, passwordHash: string): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(`${accountId}.${exp}.${passwordFingerprint(passwordHash)}`)
    .digest("hex");
}

function sign(account: Account): string {
  const exp = Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE_SECONDS;
  return `${account.id}.${exp}.${mac(account.id, exp, account.passwordHash)}`;
}

function parseToken(token: string): { accountId: string; exp: number; hmac: string } | null {
  const [accountId, expStr, hmac] = token.split(".");
  const exp = Number(expStr);
  if (!accountId || !hmac || !Number.isFinite(exp)) return null;
  if (exp < Math.floor(Date.now() / 1000)) return null;
  return { accountId, exp, hmac };
}

function macMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export interface AuthResult {
  success: boolean;
  account?: AccountPublic;
  error?: string;
}

/** Creates a new account and immediately starts a session for it, under that role's own cookie. */
export async function signUp(input: {
  email: string;
  password: string;
  role: AccountRole;
  businessId?: string;
}): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: "Enter a valid email address." };
  }
  if (input.password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }

  const existing = await accountStore.findByEmail(email);
  if (existing) {
    return { success: false, error: "An account with this email already exists." };
  }

  const passwordHash = await hashPassword(input.password);
  const account = await accountStore.create({
    email,
    passwordHash,
    role: input.role,
    businessId: input.businessId,
  });

  await startSession(account);
  return { success: true, account: toPublicAccount(account) };
}

/** Verifies credentials and starts a session, under that account's own role's cookie. */
export async function logIn(email: string, password: string): Promise<AuthResult> {
  const account = await accountStore.findByEmail(email.trim().toLowerCase());
  if (!account) {
    return { success: false, error: "Incorrect email or password." };
  }

  const valid = await verifyPassword(password, account.passwordHash);
  if (!valid) {
    return { success: false, error: "Incorrect email or password." };
  }

  await startSession(account);
  return { success: true, account: toPublicAccount(account) };
}

async function startSession(account: Account): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAMES[account.role], sign(account), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

/** Logs out one role's session. Pass no role (or omit) to clear both — used as a safety-net "log out everywhere in this browser". */
export async function logOut(role?: AccountRole): Promise<void> {
  const jar = await cookies();
  if (role) {
    jar.delete(COOKIE_NAMES[role]);
  } else {
    jar.delete(COOKIE_NAMES.admin);
    jar.delete(COOKIE_NAMES.client);
  }
}

async function readSession(role: AccountRole): Promise<AccountPublic | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAMES[role])?.value;
  if (!token) return null;

  const parsed = parseToken(token);
  if (!parsed) return null;

  const account = await accountStore.findById(parsed.accountId);
  if (!account || account.role !== role) return null;
  if (!macMatches(parsed.hmac, mac(account.id, parsed.exp, account.passwordHash))) return null;

  return toPublicAccount(account);
}

/** Reads and verifies the admin session cookie specifically. Use this on /admin and admin API routes. */
export async function getAdminSession(): Promise<AccountPublic | null> {
  return readSession("admin");
}

/** Reads and verifies the client session cookie specifically. Use this on /dashboard and client API routes. */
export async function getClientSession(): Promise<AccountPublic | null> {
  return readSession("client");
}

/** Generic: whichever session exists, admin checked first. Used only where the caller doesn't care which role — e.g. /api/auth/me. */
export async function getSession(): Promise<AccountPublic | null> {
  return (await getAdminSession()) ?? (await getClientSession());
}
