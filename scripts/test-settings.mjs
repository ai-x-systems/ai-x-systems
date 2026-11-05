import assert from "node:assert/strict";
import { hoursToText, servicesToText } from "../lib/config/hours-text.ts";
import { parseHours, parseServices } from "../lib/onboarding/build-config.ts";
import { formatPhone, digitsOnly, clockDuration } from "../lib/voice/format.ts";
import { VOICES, voiceFor, isKnownVoice } from "../lib/voice/voices.ts";

const norm = (h) => Object.fromEntries(Object.entries(h).map(([k, v]) => [k, v.closed ? "closed" : `${v.open}-${v.close}`]));

// hours survive a round trip through plain text
for (const text of ["Mon-Fri 9am-5pm\nSat 10am-2pm\nSun closed", "Mon-Sun 24 hours", "Mon-Thu 8:30am-6pm\nFri 8:30am-1:15pm", "Tue 7am-7pm"]) {
  const parsed = parseHours(text);
  const again = parseHours(hoursToText(parsed));
  assert.deepEqual(norm(again), norm(parsed), text);
}
assert.equal(hoursToText(parseHours("Mon-Fri 9am-5pm\nSat 10am-2pm")), "Mon-Fri 9:00am-5:00pm\nSat 10:00am-2:00pm\nSun closed");
assert.equal(hoursToText(parseHours("Mon-Sun 24 hours")), "Mon-Sun 12:00am-11:59pm");

// services survive a round trip
const svc = parseServices("Cleaning | $120 | 45 | Standard cleaning and exam\nWhitening | | 60\nConsult");
const again = parseServices(servicesToText(svc));
assert.deepEqual(again.map((s) => [s.name, s.price, s.durationMinutes, s.description]), svc.map((s) => [s.name, s.price, s.durationMinutes, s.description]));

// voices: only active Vapi voices; default behaviour unchanged when nothing is chosen
assert.ok(VOICES.length >= 6);
assert.ok(!VOICES.some((v) => ["Kylie", "Lily", "Spencer", "Neha", "Harry", "Cole", "Paige", "Hana"].includes(v.id)), "retired voices must not be offered");
assert.deepEqual(voiceFor(undefined, {}), { provider: "vapi", voiceId: "Elliot" });
assert.deepEqual(voiceFor("", {}), { provider: "vapi", voiceId: "Elliot" });
assert.deepEqual(voiceFor("Kylie", {}), { provider: "vapi", voiceId: "Elliot" }, "unknown or retired voice falls back");
assert.deepEqual(voiceFor("Savannah", {}), { provider: "vapi", voiceId: "Savannah", version: 2 });
assert.deepEqual(voiceFor(undefined, { VOICE_TTS_VOICE_ID: "Rohan" }), { provider: "vapi", voiceId: "Rohan" });
assert.deepEqual(voiceFor("Savannah", { VOICE_TTS_PROVIDER: "11labs" }), { provider: "11labs", voiceId: "Elliot" }, "a non-Vapi provider ignores Vapi voice names");
assert.equal(isKnownVoice("Savannah"), true);
assert.equal(isKnownVoice("nope"), false);

assert.equal(formatPhone("+12098195323"), "(209) 819-5323");
assert.equal(formatPhone("+442071838750"), "+442071838750");
assert.equal(digitsOnly("+1 (209) 819-5323"), "12098195323");
assert.equal(clockDuration(83), "1:23");
assert.equal(clockDuration(0), "0:00");
assert.equal(clockDuration(-5), "0:00");

console.log("settings tests: all passed");
