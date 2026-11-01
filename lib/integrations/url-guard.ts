/**
 * Guards for URLs that clients can type in and our server will then call (lead webhooks).
 * Without this, a client could point "their CRM" at an internal address and make our server request it.
 * Hostname checks only: they stop the obvious cases (localhost, private IPs, cloud metadata, plain http).
 */
export function isSafeWebhookUrl(raw: string | undefined | null): boolean {
  if (!raw) return false;
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return false; }
  if (u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  if (u.port && u.port !== "443") return false;
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host.includes(".")) return false; // localhost, intranet single-label names
  if (/^\[.*\]$/.test(host) || host.includes(":")) return false; // IPv6 literals
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false; // IPv4 literals (covers 127.*, 10.*, 169.254.*, 192.168.*)
  if (/\.(local|localhost|internal|lan|home|corp|intranet)$/.test(host)) return false;
  if (host === "metadata.google.internal") return false;
  return true;
}

/** Accepts a pasted Google Sheets link or a bare id and returns just the id ("" when it is neither). */
export function sheetIdFrom(input: string): string {
  const fromUrl = input.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/);
  if (fromUrl) return fromUrl[1];
  return /^[A-Za-z0-9_-]{20,}$/.test(input) ? input : "";
}
