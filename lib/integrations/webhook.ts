import "server-only";

/**
 * lib/integrations/webhook.ts
 * ---------------------------------------------------------------------
 * The "every client has their own CRM/tools" answer: instead of writing
 * a native adapter for every CRM a client happens to use, this posts a
 * flat JSON payload to one URL the client (or their CRM's own inbound
 * webhook / a Zapier / Make / n8n catch step) provides. That URL is set
 * per-business as `integrations.webhookUrl` (fires for every lead and
 * booking) and/or per-channel as `integrations.crm.webhookUrl` /
 * `integrations.leadManagement.webhookUrl` (see business-schema.ts).
 *
 * When to write a real native adapter instead: once a specific CRM comes
 * up often enough (e.g. several clients all want native HubSpot contact
 * creation with field mapping) that the generic payload genuinely isn't
 * enough — until then, this covers the large majority of "push this lead
 * somewhere else" requests with zero new code per client.
 *
 * Never throws, never blocks the caller-facing response: every call site
 * fires this with `void` the same way sendOwnerAlert/sendCallerConfirmation
 * already are, so a slow or failing client webhook can never delay or
 * break the conversation.
 * ---------------------------------------------------------------------
 */

import { isSafeWebhookUrl } from "@/lib/integrations/url-guard";

export type WebhookEventType = "lead" | "booking" | "test";

export interface WebhookPayload {
  event: WebhookEventType;
  businessId: string;
  timestampISO: string;
  data: Record<string, unknown>;
}

export interface WebhookResult {
  success: boolean;
  error?: string;
}

const TIMEOUT_MS = 5000;

/**
 * Posts one event to one URL. Swallows all failures into `{ success: false }`
 * — a client's misconfigured or down webhook must never surface as an error
 * to the caller/visitor, and must never block or fail the booking/lead flow
 * that triggered it.
 *
 * @example
 * ```ts
 * void sendWebhook(business.integrations.webhookUrl, {
 *   event: "lead",
 *   businessId: business.id,
 *   timestampISO: new Date().toISOString(),
 *   data: { callerName, callerPhone, reason },
 * });
 * ```
 */
export async function sendWebhook(
  url: string | undefined,
  payload: WebhookPayload
): Promise<WebhookResult> {
  if (!url) return { success: false, error: "No webhook URL configured." };
  if (!isSafeWebhookUrl(url)) return { success: false, error: "The webhook URL must be a public https address." };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error("[webhook] target rejected payload:", url, res.status);
      return { success: false, error: `Webhook target responded ${res.status}.` };
    }

    return { success: true };
  } catch (err) {
    console.error("[webhook] delivery failed:", url, err);
    return { success: false, error: "Could not reach the configured webhook." };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fans one event out to every configured target for a business — the
 * business-level `integrations.webhookUrl` plus any per-channel URLs
 * (`crm.webhookUrl`, `leadManagement.webhookUrl`) that are set and
 * `enabled`. Deduplicates identical URLs so a client who set the same
 * URL in two places doesn't get the same lead twice.
 *
 * @example
 * ```ts
 * void sendToConfiguredWebhooks(business, {
 *   event: "booking",
 *   businessId: business.id,
 *   timestampISO: new Date().toISOString(),
 *   data: { serviceName, callerName, startTimeISO },
 * });
 * ```
 */
export async function sendToConfiguredWebhooks(
  business: {
    integrations: {
      webhookUrl?: string;
      crm?: { enabled: boolean; webhookUrl?: string };
      leadManagement?: { enabled: boolean; webhookUrl?: string };
    };
  },
  payload: WebhookPayload
): Promise<void> {
  const urls = new Set<string>();

  if (business.integrations.webhookUrl) urls.add(business.integrations.webhookUrl);
  if (business.integrations.crm?.enabled && business.integrations.crm.webhookUrl) {
    urls.add(business.integrations.crm.webhookUrl);
  }
  if (business.integrations.leadManagement?.enabled && business.integrations.leadManagement.webhookUrl) {
    urls.add(business.integrations.leadManagement.webhookUrl);
  }

  await Promise.all(Array.from(urls).map((url) => sendWebhook(url, payload)));
}
