import "server-only";
import crypto from "crypto";

/**
 * lib/integrations/google-auth.ts
 * ---------------------------------------------------------------------
 * Shared Google service-account authentication (OAuth2 JWT-bearer flow,
 * RFC 7523), generalized from the pattern lib/integrations/calendar.ts
 * already implemented — reused here by lib/integrations/sheets.ts.
 *
 * calendar.ts itself is NOT modified to use this file (it's off-limits
 * this milestone) — it keeps its own inline copy of the same pattern.
 * This module exists so Sheets (and any future Google API integration)
 * doesn't duplicate that logic a second time. A natural follow-up, for a
 * future milestone that's allowed to touch Calendar, would be migrating
 * calendar.ts to use this shared module too and deleting its inline copy.
 *
 * No `googleapis`/`google-auth-library` dependency — same reasoning as
 * calendar.ts: the JWT-bearer token exchange is a stable, unchanging
 * spec, implemented here with Node's built-in `crypto` and plain `fetch`.
 *
 * Credentials: read once per call to getGoogleAccessToken from the
 * GOOGLE_SERVICE_ACCOUNT_JSON env var — the same service account already
 * used for Calendar (see docs/ACCOUNTS.md). One service account, multiple
 * scopes: each Google API integration requests only the scope it needs.
 * ---------------------------------------------------------------------
 */

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

// Cached per scope — a token issued for one scope isn't valid for another,
// so Calendar-shaped and Sheets-shaped tokens (if this module were ever
// used for both) must never share a cache entry.
const tokenCacheByScope = new Map<string, CachedToken>();

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function parseServiceAccountCredentials(): ServiceAccountCredentials | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.client_email !== "string" || typeof parsed.private_key !== "string") {
      return null;
    }
    return {
      client_email: parsed.client_email,
      // Defensive: normalizes a doubly-escaped "\\n" to a real newline, in
      // case an env var pipeline re-escapes the key. A correctly pasted
      // JSON value doesn't need this — JSON.parse already unescapes "\n".
      private_key: parsed.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
}

export interface GoogleAccessTokenSuccess {
  token: string;
}

export interface GoogleAccessTokenError {
  error: string;
}

export type GoogleAccessTokenResult = GoogleAccessTokenSuccess | GoogleAccessTokenError;

/**
 * Returns a valid access token for the given OAuth scope, using the
 * cached one if it has more than 30 seconds of life left, otherwise
 * performing the JWT-bearer exchange with Google's token endpoint. Never
 * throws — failures come back as `{ error }`.
 *
 * @example
 * ```ts
 * const result = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets");
 * if ("error" in result) {
 *   console.error(result.error);
 * } else {
 *   // use result.token as a Bearer token
 * }
 * ```
 */
export async function getGoogleAccessToken(scope: string): Promise<GoogleAccessTokenResult> {
  const cached = tokenCacheByScope.get(scope);
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return { token: cached.accessToken };
  }

  const creds = parseServiceAccountCredentials();
  if (!creds) {
    return { error: "Missing or invalid GOOGLE_SERVICE_ACCOUNT_JSON environment variable." };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: creds.client_email,
    scope,
    aud: TOKEN_ENDPOINT,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;

  let signature: Buffer;
  try {
    signature = crypto.createSign("RSA-SHA256").update(signingInput).sign(creds.private_key);
  } catch (err) {
    console.error("[google-auth] failed to sign JWT with service account private key:", err);
    return { error: "The configured service account private key is invalid." };
  }

  const assertion = `${signingInput}.${base64url(signature)}`;

  let res: Response;
  try {
    res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }).toString(),
    });
  } catch (err) {
    console.error("[google-auth] token request network error:", err);
    return { error: "Could not reach Google's authentication service." };
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    console.error("[google-auth] token request rejected:", res.status, bodyText);
    return { error: "Google rejected the service account credentials." };
  }

  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) {
    return { error: "Google's token response did not include an access token." };
  }

  tokenCacheByScope.set(scope, {
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  });

  return { token: json.access_token };
}