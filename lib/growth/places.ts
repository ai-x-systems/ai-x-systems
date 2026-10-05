import "server-only";
import { insertDiscovered, getCursor, setCursor } from "./store";
import { scoreLead } from "./pure";
import type { GrowthSettings } from "./types";

const FIELDS = "places.id,places.displayName,places.websiteUri,places.nationalPhoneNumber,places.formattedAddress,places.rating,places.userRatingCount";

interface Place {
  id: string;
  displayName?: { text?: string };
  websiteUri?: string;
  nationalPhoneNumber?: string;
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
}

/**
 * Finds local businesses via Google Places (New) Text Search. Only keeps
 * businesses that HAVE a website — no website means no way to find a
 * contact email, and they're rarely the buyer for a website assistant.
 * Rotates through industry × city combinations across runs.
 */
export async function discover(settings: GrowthSettings, combosPerRun = 2): Promise<{ found: number; note?: string }> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return { found: 0, note: "GOOGLE_PLACES_API_KEY not set" };
  if (settings.industries.length === 0 || settings.cities.length === 0) {
    return { found: 0, note: "Add at least one industry and one city in Growth settings" };
  }

  const combos = settings.industries.flatMap((ind) => settings.cities.map((city) => ({ ind, city })));
  let cursor = await getCursor();
  let total = 0;

  for (let n = 0; n < combos.length && n < combosPerRun; n++) {
    const { ind, city } = combos[cursor % combos.length];
    cursor += 1;

    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
      body: JSON.stringify({ textQuery: `${ind} in ${city}`, pageSize: Math.min(settings.discoverPerRun, 20) }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error("[growth] Places search failed:", res.status, await res.text().catch(() => ""));
      continue;
    }
    const { places = [] } = (await res.json()) as { places?: Place[] };

    const rows = places
      .filter((p) => p.websiteUri && p.displayName?.text)
      .map((p) => ({
        place_id: p.id,
        business_name: p.displayName!.text!,
        industry: ind,
        city,
        country: settings.country,
        address: p.formattedAddress ?? null,
        website: p.websiteUri!,
        phone: p.nationalPhoneNumber ?? null,
        rating: p.rating ?? null,
        review_count: p.userRatingCount ?? null,
        score: scoreLead({ reviewCount: p.userRatingCount, rating: p.rating, phone: p.nationalPhoneNumber }),
      }));
    total += await insertDiscovered(rows);
  }

  await setCursor(cursor);
  return { found: total };
}
