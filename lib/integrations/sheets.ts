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
 * Default tab name, used only when a business doesn't set
 * integrations.leadSheetTabName — Google Sheets' default tab name for a
 * newly created spreadsheet.
 */
const DEFAULT_TAB_NAME = "Sheet1";

function appendRangeFor(tabName: string): string {
  return `${tabName}!A1:F1`;
}

export interface LeadRecord {
  businessId: string;
  callerName?: string;
  callerPhone?: string;
  callerEmail?: string;
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
 *   business.integrations.leadSheetId ?? "",
 *   business.integrations.leadSheetTabName
 * );
 * if (!result.success) {
 *   console.error(result.error);
 * }
 * ```
 */
export async function logLead(
  record: LeadRecord,
  sheetId: string,
  tabName: string = DEFAULT_TAB_NAME
): Promise<SheetsResult> {
  if (!sheetId) {
    return { success: false, error: "No lead-tracking sheet is configured for this business." };
  }

  const tokenResult = await getGoogleAccessToken(SHEETS_SCOPE);
  if ("error" in tokenResult) {
    console.error("[sheets] authentication failed:", tokenResult.error);
    return { success: false, error: "Could not authenticate with Google Sheets." };
  }

  // Column order matches the actual sheet header row this app writes to
  // (Timestamp | Name | Phone | Email | Service | Notes) — NOT the order
  // LeadRecord's own fields happen to be declared in. A prior version of
  // this row array used [businessId, callerName, callerPhone, reason,
  // callTimestampISO, callSummary], which silently wrote real data into
  // the wrong labeled columns (e.g. the timestamp landed under "Service")
  // for every business until caught by inspecting real spreadsheet rows.
  const row = [
    record.callTimestampISO,
    record.callerName ?? "",
    record.callerPhone ?? "",
    record.callerEmail ?? "",
    record.reason,
    record.callSummary ?? "",
  ];

  try {
    const url =
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}` +
      `/values/${encodeURIComponent(appendRangeFor(tabName))}:append` +
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
