import "server-only";
import crypto from "crypto";
import { businessIdTaken, saveNewBusiness } from "@/lib/config/business-store";
import { buildDemoConfig, demoDraftIsUsable, demoId } from "./build-config";
import { draftFromWebsite } from "./from-website";

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
}): Promise<DemoResult> {
  const r = await draftFromWebsite(input.website);
  if (!r.draft) {
    const transient = /busy|try again/i.test(r.error ?? "");
    return { ok: false, reason: transient ? "transient" : "unusable", message: r.error ?? "Could not read the website." };
  }
  if (!demoDraftIsUsable(r.draft)) {
    return { ok: false, reason: "unusable", message: "The website didn't state opening hours plus a service or FAQ, so a faithful preview isn't possible." };
  }

  let id = demoId(input.name, crypto.randomBytes(3).toString("hex"));
  for (let n = 0; n < 3 && (await businessIdTaken(id)); n++) id = demoId(input.name, crypto.randomBytes(3).toString("hex"));

  const config = buildDemoConfig(
    {
      name: input.name,
      industry: input.industry || r.draft.industry || "Local business",
      website: input.website,
      phone: input.phone || r.draft.phone,
      address: input.address || r.draft.address,
      // Never used: demo businesses send no alerts. Kept valid for the schema.
      notifyEmail: process.env.FOUNDER_NOTIFY_EMAIL || "demo@example.com",
      hoursText: r.draft.hoursText,
      servicesText: r.draft.servicesText,
      faqsText: r.draft.faqsText,
      policiesText: r.draft.policiesText,
    },
    id
  );
  await saveNewBusiness(config, undefined, { services: "chat", source: "demo", billingStatus: "demo" });
  return { ok: true, businessId: id };
}
