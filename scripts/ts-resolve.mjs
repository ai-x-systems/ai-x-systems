// Lets plain `node` run the repo's TypeScript in tests: extension-less relative imports and the "@/" alias.
import { pathToFileURL, fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function resolve(specifier, context, next) {
  // Next provides "server-only" at build time; under plain node it throws, so stub it for tests.
  if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
  if (specifier.startsWith("@/")) {
    const base = path.join(root, specifier.slice(2));
    for (const cand of [base + ".ts", path.join(base, "index.ts")]) {
      if (existsSync(cand)) return next(pathToFileURL(cand).href, context);
    }
  }
  try {
    return await next(specifier, context);
  } catch (e) {
    if (e.code === "ERR_MODULE_NOT_FOUND" && specifier.startsWith(".") && !/\.\w+$/.test(specifier)) {
      return next(specifier + ".ts", context);
    }
    throw e;
  }
}
