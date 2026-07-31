import "server-only";
import crypto from "crypto";

/**
 * lib/integrations/calendar.ts
 * ---------------------------------------------------------------------
 * Google Calendar booking integration. Replaces the earlier always-succeeds
 * stub — the exported interface (BookingRequest, BookingResult,
 * bookAppointment) is unchanged, so lib/tools/execute-tool-call.ts (the
 * Tool Executor) required zero changes to call the real implementation.
 *
 * Auth: a Google service account, not per-client OAuth. The full service
 * account JSON key file's contents go in the GOOGLE_SERVICE_ACCOUNT_JSON
 * env var (see docs/ACCOUNTS.md). Each business's calendar must be shared
 * with that service account's email address (Calendar → Settings →
 * "Share with specific people") with "Make changes to events" permission.
 *
 * Auth implementation: this hand-rolls the OAuth2 JWT-bearer token
 * exchange with Node's built-in `crypto` module rather than adding the
 * `googleapis` or `google-auth-library` package. That flow is a stable,
 * unchanging spec (RFC 7523 + Google's token endpoint), not an evolving
 * SDK surface — same reasoning already applied to lib/llm/groq-client.ts's
 * choice of plain fetch over an SDK. All Google-specific logic (token
 * exchange, event body shape, REST endpoint) is isolated to this one file;
 * nothing elsewhere in the app knows Google Calendar is the provider.
 *
 * Scope: creating events only, via a service account. No availability/
 * free-busy checks, no updates or cancellations, no per-client OAuth —
 * none of those were asked for by this milestone.
 * ---------------------------------------------------------------------
 */

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

// ---------------------------------------------------------------------------
// Public interface — unchanged from the stub this replaces
// ---------------------------------------------------------------------------

export interface BookingRequest {
  calendarId: string;
  summary: string; // e.g. "Cleaning — Jane Doe"
  startTimeISO: string;
  durationMinutes: number;
  timezone: string;
  attendeeName: string;
  attendeePhone: string;
}

export interface BookingResult {
  success: boolean;
  eventId?: string;
  confirmedStartTimeISO?: string;
  error?: string;
}

/**
 * Books an appointment on the business's Google Calendar by creating an
 * event via a service account. Never throws — every failure mode (missing
 * credentials, auth failure, API rejection, network error) comes back as
 * `{ success: false, error }`. Full diagnostic detail is logged
 * server-side via console.error; the returned `error` string is a
 * sanitized, human-readable summary, not a raw Google API error body.
 *
 * There's no `attendees` field on the created event — the caller only
 * provides a name and phone number, not an email, and Calendar attendees
 * require an email. Name and phone are included in the event description
 * instead.
 *
 * @example
 * ```ts
 * const result = await bookAppointment({
 *   calendarId: business.integrations.googleCalendarId ?? "",
 *   summary: `${service.name} — ${callerName}`,
 *   startTimeISO: "2026-08-05T14:00:00",
 *   durationMinutes: 45,
 *   timezone: "America/Chicago",
 *   attendeeName: callerName,
 *   attendeePhone: callerPhone,
 * });
 * if (result.success) {
 *   console.log(result.eventId, result.confirmedStartTimeISO);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export async function bookAppointment(request: BookingRequest): Promise<BookingResult> {
  if (!request.calendarId) {
    return { success: false, error: "No calendar is configured for this business." };
  }

  const tokenResult = await getAccessToken();
  if ("error" in tokenResult) {
    console.error("[calendar] authentication failed:", tokenResult.error);
    return { success: false, error: "Could not authenticate with Google Calendar." };
  }

  const eventBody = buildEventBody(request);

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(request.calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenResult.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventBody),
      }
    );

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      console.error("[calendar] event creation failed:", res.status, bodyText);
      return { success: false, error: "Google Calendar rejected the booking request." };
    }

    const json = (await res.json()) as { id?: string; start?: { dateTime?: string } };

    return {
      success: true,
      eventId: json.id,
      confirmedStartTimeISO: json.start?.dateTime ?? request.startTimeISO,
    };
  } catch (err) {
    console.error("[calendar] unexpected error creating event:", err);
    return { success: false, error: "Something went wrong while booking the appointment." };
  }
}

// ---------------------------------------------------------------------------
// Event body construction
// ---------------------------------------------------------------------------

interface CalendarEventBody {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
}

function buildEventBody(request: BookingRequest): CalendarEventBody {
  return {
    summary: request.summary,
    description: `Booked via AI Receptionist.\nName: ${request.attendeeName}\nPhone: ${request.attendeePhone}`,
    start: { dateTime: request.startTimeISO, timeZone: request.timezone },
    end: {
      dateTime: addMinutesToIso(request.startTimeISO, request.durationMinutes),
      timeZone: request.timezone,
    },
  };
}

/**
 * Adds minutes to an ISO 8601 datetime string via direct component
 * arithmetic — deliberately not `new Date(iso)` + `.toISOString()`, which
 * would silently reinterpret a timezone-naive input (no "Z"/offset) as UTC
 * or local time depending on the runtime's default timezone, corrupting
 * the wall-clock time it represents. This preserves whatever offset (or
 * lack of one) the input had, applying only the requested duration.
 */
function addMinutesToIso(isoDateTime: string, minutes: number): string {
  const match = isoDateTime.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/
  );

  if (!match) {
    // Unexpected format — best-effort fallback rather than throwing.
    const d = new Date(isoDateTime);
    d.setUTCMinutes(d.getUTCMinutes() + minutes);
    return d.toISOString();
  }

  const [, year, month, day, hour, minute, second, , offset] = match;

  const totalMinutes = parseInt(hour, 10) * 60 + parseInt(minute, 10) + minutes;
  const newHour = Math.floor(totalMinutes / 60) % 24;
  const newMinute = totalMinutes % 60;
  const dayOverflow = Math.floor(totalMinutes / (60 * 24));

  const datePart = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  datePart.setUTCDate(datePart.getUTCDate() + dayOverflow);

  const pad = (n: number) => String(n).padStart(2, "0");
  const newDate = `${datePart.getUTCFullYear()}-${pad(datePart.getUTCMonth() + 1)}-${pad(
    datePart.getUTCDate()
  )}`;

  return `${newDate}T${pad(newHour)}:${pad(newMinute)}:${second ?? "00"}${offset ?? ""}`;
}

// ---------------------------------------------------------------------------
// Service-account authentication (Google OAuth2 JWT-bearer flow)
// ---------------------------------------------------------------------------

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

// Module-level cache: reused across requests within the same warm
// server instance. A cold start simply re-authenticates.
let cachedToken: CachedToken | null = null;

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

/**
 * Returns a valid access token, using the cached one if it has more than
 * 30 seconds of life left, otherwise performing the JWT-bearer exchange
 * with Google's token endpoint. Not exported — internal to this file, per
 * "keep provider-specific logic isolated."
 */
async function getAccessToken(): Promise<{ token: string } | { error: string }> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return { token: cachedToken.accessToken };
  }

  const creds = parseServiceAccountCredentials();
  if (!creds) {
    return { error: "Missing or invalid GOOGLE_SERVICE_ACCOUNT_JSON environment variable." };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: creds.client_email,
    scope: CALENDAR_SCOPE,
    aud: TOKEN_ENDPOINT,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;

  let signature: Buffer;
  try {
    signature = crypto.createSign("RSA-SHA256").update(signingInput).sign(creds.private_key);
  } catch (err) {
    console.error("[calendar] failed to sign JWT with service account private key:", err);
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
    console.error("[calendar] token request network error:", err);
    return { error: "Could not reach Google's authentication service." };
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    console.error("[calendar] token request rejected:", res.status, bodyText);
    return { error: "Google rejected the service account credentials." };
  }

  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) {
    return { error: "Google's token response did not include an access token." };
  }

  cachedToken = {
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };

  return { token: json.access_token };
}