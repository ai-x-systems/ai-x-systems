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

  return cache;
}
