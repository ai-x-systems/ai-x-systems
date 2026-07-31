import "server-only";
import { getGoogleAccessToken } from "@/lib/integrations/google-auth";

/**
 * lib/integrations/sheets.ts
 * ---------------------------------------------------------------------
 * Google Sheets lead-logging integration. Replaces the console.log stub —
 * the exported LeadRecord shape and logLead's parameters are unchanged,
 * so lib/tools/execute-tool-call.ts (the Tool Executor) required no
 * changes to call the real implementation. (logLead's return type moved
 * from Promise<void> to Promise<SheetsResult> — see the note on that
 * function for why this doesn't break the existing call site.)
 *
 * Auth: reuses the same Google service account and JWT-bearer pattern
 * already implemented for Calendar, via the shared
 * lib/integrations/google-auth.ts helper — same GOOGLE_SERVICE_ACCOUNT_JSON
 * env var, different OAuth scope. Each business's lead sheet must be
 * shared with that service account's email address (Sheet → Share) with
 * Editor access — same sharing model as Calendar (see docs/ACCOUNTS.md).
 *
 * No `googleapis` dependency — plain fetch against the Sheets API v4 REST
 * endpoint, consistent with Calendar's approach.
 * ---------------------------------------------------------------------
 */

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

/**
 * Range appended to. Assumes the target spreadsheet's first tab is named
 * "Sheet1" — Google Sheets' default tab name for a newly created
 * spreadsheet. If a client's sheet has a renamed or additional tab, leads
 * should be logged on a tab actually named "Sheet1", or this constant
 * updated to match — not configurable per-business in this milestone
 * (would mean extending BusinessConfig, which is out of scope here).
 */
const APPEND_RANGE = "Sheet1!A1:F1";

export interface LeadRecord {
  businessId: string;
  callerName?: string;
  callerPhone?: string;
  reason: string;
  callTimestampISO: string;
  callSummary?: string;
}

export interface SheetsResult {
  success: boolean;
  error?: string;
}

/**
 * Appends one row to the business's lead-tracking Google Sheet:
 * businessId, callerName, callerPhone, reason, callTimestampISO,
 * callSummary — in that fixed column order (A–F), missing optional
 * fields written as empty strings so column alignment never shifts.
 *
 * Never throws — every failure mode (missing sheet id, auth failure, API
 * rejection, network error) comes back as `{ success: false, error }`,
 * with full diagnostic detail logged server-side via console.error and
 * only a sanitized message returned.
 *
 * Return type changed from the stub's `Promise<void>` to
 * `Promise<SheetsResult>` — the Tool Executor's existing call site
 * (`await logLead(...)`) doesn't read the resolved value, so this is not
 * a breaking change to that call site; it's purely additive for any
 * future caller that wants to check the outcome.
 *
 * @example
 * ```ts
 * const result = await logLead(
 *   {
 *     businessId: business.id,
 *     callerName: "Jane Doe",
 *     callerPhone: "555-0100",
 *     reason: "Asking about pricing",
 *     callTimestampISO: new Date().toISOString(),
 *   },
 *   business.integrations.leadSheetId ?? ""
 * );
 * if (!result.success) {
 *   console.error(result.error);
 * }
 * ```
 */
export async function logLead(record: LeadRecord, sheetId: string): Promise<SheetsResult> {
  if (!sheetId) {
    return { success: false, error: "No lead-tracking sheet is configured for this business." };
  }

  const tokenResult = await getGoogleAccessToken(SHEETS_SCOPE);
  if ("error" in tokenResult) {
    console.error("[sheets] authentication failed:", tokenResult.error);
    return { success: false, error: "Could not authenticate with Google Sheets." };
  }

  const row = [
    record.businessId,
    record.callerName ?? "",
    record.callerPhone ?? "",
    record.reason,
    record.callTimestampISO,
    record.callSummary ?? "",
  ];

  try {
    const url =
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}` +
      `/values/${encodeURIComponent(APPEND_RANGE)}:append` +
      `?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenResult.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [row] }),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      console.error("[sheets] append failed:", res.status, bodyText);
      return { success: false, error: "Google Sheets rejected the append request." };
    }

    return { success: true };
  } catch (err) {
    console.error("[sheets] unexpected error appending lead:", err);
    return { success: false, error: "Something went wrong while logging the lead." };
  }
}