import "server-only";
import { discover } from "./places";
import { demoBatch, cleanupDemos } from "./demos";
import { enrichBatch } from "./enrich";
import { draftBatch } from "./draft";
import { sendApproved } from "./send";
import { getSettings } from "./store";

export type GrowthTask = "discover" | "enrich" | "demo" | "draft" | "send";
export const ALL_TASKS: GrowthTask[] = ["discover", "enrich", "demo", "draft", "send"];

/** One pass of the whole acquisition loop. Each stage is bounded so a run always fits its time budget. */
export async function runGrowth(tasks: GrowthTask[] = ALL_TASKS): Promise<Record<string, unknown>> {
  const settings = await getSettings();
  const out: Record<string, unknown> = {};
  const deadline = Date.now() + 52_000; // function limit is 60s
  for (const t of tasks) {
    try {
      if (t === "discover") out.discover = await discover(settings);
      if (t === "enrich") out.enrich = await enrichBatch(10, deadline);
      if (t === "demo") out.demo = { ...(await demoBatch(3, deadline)), ...(await cleanupDemos()) };
      if (t === "draft") out.draft = await draftBatch(settings);
      if (t === "send") out.send = await sendApproved(settings);
    } catch (err) {
      console.error(`[growth] ${t} failed:`, err);
      out[t] = { error: err instanceof Error ? err.message : "failed" };
    }
  }
  return out;
}
