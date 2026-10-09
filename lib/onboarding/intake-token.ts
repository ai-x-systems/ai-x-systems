import crypto from "crypto";

export const INTAKE_TTL_DAYS = 14;

/** The link carries the token; only its SHA-256 is stored, so a database leak can't be turned into working links. */
export function hashIntakeToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function newIntakeToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(24).toString("base64url");
  return { token, hash: hashIntakeToken(token) };
}

export function intakeExpiry(now = Date.now()): string {
  return new Date(now + INTAKE_TTL_DAYS * 86_400_000).toISOString();
}

export function intakeIsUsable(row: { status: string; expires_at: string } | null | undefined, now = Date.now()): boolean {
  return !!row && row.status === "pending" && new Date(row.expires_at).getTime() > now;
}

/** Tokens we generate are 32 url-safe chars; anything else is rejected before touching the database. */
export function looksLikeIntakeToken(t: string): boolean {
  return /^[A-Za-z0-9_-]{32}$/.test(t);
}
