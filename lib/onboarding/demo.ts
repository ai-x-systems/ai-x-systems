import "server-only";
import crypto from "crypto";
import { businessIdTaken, saveNewBusiness } from "@/lib/config/business-store";
import { buildDemoConfig, demoDraftIsUsable, demoId, draftHoursAreKnown } from "./build-config";
import { describeDiagnostics, draftFromWebsite } from "./from-website";

export type DemoResult =
  | { ok: true; businessId: string }
  | { ok: false; reason: "unusable" | "transient"; message: string };

/**
 * Builds a private preview business from a prospect's public website.
 * Nothing the preview does can reach the prospect or a real inbox: the
 * business is flagged demo (no alerts, no sheet, no webhook, no billing),
 * its prices are stripped, and it is only reachable through an unguessable
 * link. "transient" failures (the AI was busy) are worth retrying later;
 * "unusable" means the site didn't give us enough to build a faithful preview.
 */
export async function createPreviewBusiness(input: {
  name: string;
  industry?: string;
  website: string;
  phone?: string;
  address?: string;
  /** typed by the admin when the site doesn't state them (e.g. copied from Google Maps): always wins over the site */
  hoursText?: string;
  servicesText?: string;
  /** typed by the admin; wins over the colour detected on the site */
  brandColor?: string;
}): Promise<DemoResult> {
  const r = await draftFromWebsite(input.website);
  const overrides = !!(input.hoursText?.trim() || input.servicesText?.trim());
  if (!r.draft && !overrides) {
    const transient = /busy|try again/i.test(r.error ?? "");
    return { ok: false, reason: transient ? "transient" : "unusable", message: r.error ?? "Could not read the website." };
  }
  const draft = {
    ...(r.draft ?? {}),
    hoursText: input.hoursText?.trim() || r.draft?.hoursText,
    servicesText: input.servicesText?.trim() || r.draft?.servicesText,
  };
  if (!demoDraftIsUsable(draft)) {
    const seen = r.diagnostics ? " " + describeDiagnostics(r.diagnostics) : "";
    return { ok: false, reason: "unusable", message: `There was no service or FAQ to answer from.${seen} Add a few services in the box below (copy them from their site or Google Maps) and try again, or pick a different business.` };
  }
  const hoursKnown = draftHoursAreKnown(draft.hoursText);

  let id = demoId(input.name, crypto.randomBytes(3).toString("hex"));
  for (let n = 0; n < 3 && (await businessIdTaken(id)); n++) id = demoId(input.name, crypto.randomBytes(3).toString("hex"));

  const config = buildDemoConfig(
    {
      name: input.name,
      industry: input.industry || draft.industry || "Local business",
      website: input.website,
      phone: input.phone || draft.phone,
      address: input.address || draft.address,
      // Never used: demo businesses send no alerts. Kept valid for the schema.
      notifyEmail: process.env.FOUNDER_NOTIFY_EMAIL || "demo@example.com",
      hoursText: hoursKnown ? draft.hoursText : undefined,
      hoursUnknown: !hoursKnown,
      brandColor: input.brandColor || (draft as { brandColor?: string }).brandColor,
      servicesText: draft.servicesText,
      faqsText: (draft as { faqsText?: string }).faqsText,
      policiesText: (draft as { policiesText?: string }).policiesText,
    },
    id
  );
  await saveNewBusiness(config, undefined, { services: "chat", source: "demo", billingStatus: "demo" });
  return { ok: true, businessId: id };
}
