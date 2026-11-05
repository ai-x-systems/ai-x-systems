import "server-only";
import { getStoredBusiness, setBusinessFlags, updateBusinessConfig } from "@/lib/config/business-store";
import { defaultPhoneGreeting, resolvePhoneGreeting } from "@/lib/config/greetings";
import { hoursAreUsable, parseHours, parseServices } from "@/lib/onboarding/build-config";
import { isKnownVoice } from "@/lib/voice/voices";

/**
 * Everything a client (or you, on their behalf) can change about their assistant and business.
 * One function used by BOTH the client dashboard and the admin "manage client" page, so they can never drift apart.
 * Each change is validated, then the whole config is re-validated before it is saved.
 */
export type SettingsResult = { ok: true } | { ok: false; status: number; error: string };
export const SETTINGS_ACTIONS = ["profile", "assistant", "hours", "services", "pause", "resume"] as const;

const cap = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
const fail = (error: string, status = 400): SettingsResult => ({ ok: false, status, error });
const TONES = ["friendly", "professional", "warm", "concise"] as const;
const NAME_OK = /^[\p{L}\p{N} .'&-]{1,30}$/u;

function validTimezone(tz: string): boolean {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz.length > 2; } catch { return false; }
}

export async function applyClientSettings(businessId: string, body: Record<string, unknown>): Promise<SettingsResult> {
  const stored = await getStoredBusiness(businessId);
  if (!stored || stored.source !== "db") return fail("These settings can't be changed from here.", 400);
  const c = stored.config;
  const done = (r: { ok: true } | { ok: false; error: string }): SettingsResult => (r.ok ? { ok: true } : fail(r.error));

  switch (body.action) {
    case "profile": {
      const name = cap(body.name, 120);
      if (!name) return fail("The business needs a name.");
      return done(await updateBusinessConfig(businessId, (x) => ({
        ...x, name,
        phoneNumber: cap(body.phone, 40) || x.phoneNumber,
        contact: { ...x.contact, address: cap(body.address, 200) || undefined, website: cap(body.website, 200) || undefined },
      })));
    }

    case "assistant": {
      const name = cap(body.assistantName, 30);
      if (!NAME_OK.test(name)) return fail("Choose a name of up to 30 letters or numbers, like Ava, Max or Front Desk.");
      const tone = TONES.find((t) => t === body.tone);
      if (!tone) return fail("Choose a tone.");
      const voiceRaw = cap(body.voiceId, 40);
      if (voiceRaw && !isKnownVoice(voiceRaw)) return fail("That voice isn't available. Choose one from the list.");

      // A blank greeting means "use the standard one", written for the new name.
      const typed = typeof body.greeting === "string" ? body.greeting.replace(/\s+/g, " ").trim().slice(0, 400) : "";
      const greeting = typed || defaultPhoneGreeting(c.name, name);
      if (typed) {
        const effective = resolvePhoneGreeting({ name: c.name, voice: { assistantName: name, greeting: typed } });
        if (effective !== typed) return fail("Your phone greeting must tell callers they're speaking to a virtual assistant, for example: \"Thanks for calling " + c.name + ", this is " + name + ", the virtual assistant. How can I help?\"");
      }
      return done(await updateBusinessConfig(businessId, (x) => ({ ...x, voice: { ...x.voice, assistantName: name, tone, greeting, voiceId: voiceRaw || undefined } })));
    }

    case "hours": {
      const text = typeof body.hoursText === "string" ? body.hoursText : "";
      const tz = cap(body.timezone, 60) || c.timezone;
      if (!validTimezone(tz)) return fail("That timezone isn't recognised. Pick one from the list.");
      if (!text.trim()) return fail("Write your opening hours, one line per day range, like: Mon-Fri 9am-5pm");
      const hours = parseHours(text);
      if (!hoursAreUsable(hours)) return fail("We couldn't read those hours. Write one line per day range, like: Mon-Fri 9am-5pm (and Sun closed).");
      return done(await updateBusinessConfig(businessId, (x) => ({ ...x, hours, hoursKnown: true, timezone: tz, booking: { ...x.booking, timezone: tz } })));
    }

    case "services": {
      if (c.booking.enabled && c.booking.appointmentTypes.length > 0) {
        return fail("Online booking is switched on for this business and is tied to its services, so changing them here could break bookings. Send us a change request instead.", 409);
      }
      const text = typeof body.servicesText === "string" ? body.servicesText : "";
      const services = parseServices(text);
      return done(await updateBusinessConfig(businessId, (x) => ({ ...x, knowledge: { ...x.knowledge, services } })));
    }

    case "pause":
    case "resume":
      await setBusinessFlags(businessId, { active: body.action === "resume" });
      return { ok: true };

    default:
      return fail("Unknown action.");
  }
}
