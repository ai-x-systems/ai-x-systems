import "server-only";
import { listLeads, updateLead } from "./store";
import { extractBestEmail, detectSignals, isSafePublicUrl, scoreLead } from "./pure";

const MAX_BYTES = 400_000;

async function fetchText(url: string): Promise<string> {
  const safe = isSafePublicUrl(url);
  if (!safe) return "";
  try {
    const res = await fetch(safe.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AIxSystemsBot/1.0)", Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return "";
    // Guard against a redirect into a private address.
    if (!isSafePublicUrl(res.url)) return "";
    return (await res.text()).slice(0, MAX_BYTES);
  } catch {
    return "";
  }
}

/** Reads each lead's site (home + contact pages), finds a public business email, and records website signals. */
export async function enrichBatch(limit = 10): Promise<{ enriched: number; noEmail: number }> {
  const leads = await listLeads({ stage: "discovered", limit });
  let enriched = 0, noEmail = 0;

  // Small parallel pool — keeps a cron run well inside its time budget.
  const queue = [...leads];
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      for (let lead = queue.shift(); lead; lead = queue.shift()) {
        const base = lead.website!;
        let origin = base;
        try { origin = new URL(/^https?:/i.test(base) ? base : `https://${base}`).origin; } catch { /* keep */ }

        const pages = await Promise.all([base, `${origin}/contact`, `${origin}/contact-us`].map(fetchText));
        const html = pages.join("\n");
        const email = extractBestEmail(html, base);
        const signals = detectSignals(html);
        const score = scoreLead({ reviewCount: lead.reviewCount, rating: lead.rating, phone: lead.phone, chatWidget: signals.chatWidget });

        if (email) {
          await updateLead(lead.id, { email, signals, score, stage: "enriched" });
          enriched++;
        } else {
          await updateLead(lead.id, { signals, score, stage: "no_email" });
          noEmail++;
        }
      }
    })
  );
  return { enriched, noEmail };
}
