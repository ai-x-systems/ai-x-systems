import fs from "fs";
import path from "path";
import { BusinessConfigSchema, BusinessConfig } from "./business-schema";

const DATA_DIR = path.join(process.cwd(), "data", "businesses");

let cache: BusinessConfig[] | null = null;

/**
 * Reads every *.json file in data/businesses, validates it against
 * BusinessConfigSchema, and returns typed configs. A malformed file throws
 * immediately with the file name and the exact validation error — fail at
 * boot, not mid-call.
 *
 * Cached in memory per server instance; this only matters in serverless
 * cold-start terms (each function instance reads the files once).
 */
export function loadAllBusinesses(): BusinessConfig[] {
  if (cache) return cache;

  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));

  cache = files.map((file) => {
    const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
    const parsed = BusinessConfigSchema.safeParse(raw);

    if (!parsed.success) {
      throw new Error(
        `Invalid business config in data/businesses/${file}:\n${parsed.error.message}`
      );
    }

    return parsed.data;
  });

  // TEMPORARY DEBUG LOGGING — remove after diagnosing the unknown_business issue.
  console.log({
    DATA_DIR,
    files,
    businessIds: cache.map((b) => b.id),
  });

  return cache;
}

/**
 * Convenience lookup, calling loadAllBusinesses() internally. Note:
 * config/businesses/index.ts already exposes an equivalent
 * getBusinessById — that's what app/api/chat currently imports and
 * continues to import unchanged. This export exists for any future
 * caller that wants to go through the loader directly.
 */
export function getBusinessById(id: string): BusinessConfig | undefined {
  return loadAllBusinesses().find((b) => b.id === id);
}

/**
 * Convenience lookup by phone number, calling loadAllBusinesses()
 * internally. Added for future use by the Vapi voice channel, which will
 * need to resolve an incoming call's business by its phone number rather
 * than by businessId.
 */
export function getBusinessByPhone(phone: string): BusinessConfig | undefined {
  return loadAllBusinesses().find((b) => b.phoneNumber === phone);
}
