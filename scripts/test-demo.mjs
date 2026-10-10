import assert from "node:assert/strict";
import { demoDraftIsUsable, demoId, isDemoId, buildDemoConfig, buildBusinessConfig, isServices } from "../lib/onboarding/build-config.ts";
import { newIntakeToken, hashIntakeToken, intakeIsUsable, intakeExpiry, looksLikeIntakeToken, INTAKE_TTL_DAYS } from "../lib/onboarding/intake-token.ts";
import { buildEmail } from "../lib/growth/pure.ts";

// a preview needs hours AND (a service or an FAQ)
assert.equal(demoDraftIsUsable({ hoursText: "Mon-Fri 9-5", servicesText: "Cleaning" }), true);
assert.equal(demoDraftIsUsable({ hoursText: "Mon-Fri 9-5", faqsText: "Parking? | Free." }), true);
assert.equal(demoDraftIsUsable({ servicesText: "Cleaning", faqsText: "Q | A" }), false, "no hours = would invent hours");
assert.equal(demoDraftIsUsable({ hoursText: "Mon-Fri 9-5" }), false, "hours alone is too thin");
assert.equal(demoDraftIsUsable({ hoursText: "  ", servicesText: "x" }), false);
assert.equal(demoDraftIsUsable(null), false);
assert.equal(demoDraftIsUsable({ hoursText: "By appointment only", servicesText: "x" }), false, "unreadable hours must not become \"closed all week\"");
assert.equal(demoDraftIsUsable({ hoursText: "Open 24 hours", servicesText: "x" }), true);
assert.equal(demoDraftIsUsable(undefined), false);

// ids
const id = demoId("Bright Smile Dental, LLC!!", "a1b2c3");
assert.equal(id, "demo-bright-smile-dental-llc-a1b2c3");
assert.equal(isDemoId(id), true);
assert.equal(isDemoId("bright-smile"), false);
assert.equal(isDemoId("ai-x-systems"), false);

// preview config: demo flag, prices stripped, honesty notes
const cfg = buildDemoConfig({ name: "Bright Smile", industry: "Dentist", notifyEmail: "demo@example.com", hoursText: "Mon-Fri 8-4", servicesText: "Exam | $80 | 30 | Check-up\nCleaning | $120", faqsText: "Parking? | Free lot." }, id);
assert.equal(cfg.demo, true);
assert.equal(cfg.booking.enabled, false);
assert.equal(cfg.knowledge.services.length, 2);
for (const svc of cfg.knowledge.services) assert.equal("price" in svc, false, "AI-extracted prices must never reach a preview");
assert.match(cfg.knowledge.policies.general[0], /preview/i);
assert.match(cfg.knowledge.policies.general[1], /pricing/i);
assert.equal(cfg.hours.monday.close, "16:00");

// a real client is never a demo, and keeps its prices
const real = buildBusinessConfig({ name: "Real Co", industry: "Plumber", notifyEmail: "a@b.co", servicesText: "Leak repair | $90" }, "real-co");
assert.equal(real.demo, false);
assert.equal(real.knowledge.services[0].price, "$90");

assert.equal(isServices("chat") && isServices("voice") && isServices("both"), true);
assert.equal(isServices("phone"), false);
assert.equal(isServices(undefined), false);

// intake tokens
const t = newIntakeToken();
assert.equal(looksLikeIntakeToken(t.token), true);
assert.equal(t.token.length, 32);
assert.equal(t.hash, hashIntakeToken(t.token));
assert.notEqual(t.hash, t.token, "only the hash is stored");
assert.notEqual(newIntakeToken().token, t.token);
for (const bad of ["", "short", "x".repeat(31), "x".repeat(33), "../etc/passwd" + "x".repeat(20), "a b".repeat(11)]) assert.equal(looksLikeIntakeToken(bad), false, bad);

const now = Date.now();
assert.equal(intakeIsUsable({ status: "pending", expires_at: new Date(now + 1000).toISOString() }, now), true);
assert.equal(intakeIsUsable({ status: "pending", expires_at: new Date(now - 1000).toISOString() }, now), false, "expired");
assert.equal(intakeIsUsable({ status: "completed", expires_at: new Date(now + 1000).toISOString() }, now), false, "one-time use");
assert.equal(intakeIsUsable({ status: "cancelled", expires_at: new Date(now + 1000).toISOString() }, now), false);
assert.equal(intakeIsUsable(null, now), false);
const exp = new Date(intakeExpiry(now)).getTime();
assert.equal(Math.round((exp - now) / 86_400_000), INTAKE_TTL_DAYS);

// emails: with a preview the link leads; without it nothing changes
const base = { businessName: "Bright Smile", industry: "dentist", city: "Austin", senderName: "Alex", demoUrl: "https://x/demo", offer: "chat" };
const e1 = buildEmail({ ...base, step: 1, tryUrl: "https://x/try/demo-1" });
assert.match(e1.body, /https:\/\/x\/try\/demo-1/);
assert.match(e1.subject, /preview/i);
assert.doesNotMatch(e1.body, /phone line/, "chat offer must not promise phone");
assert.match(buildEmail({ ...base, offer: "voice", step: 1, tryUrl: "https://x/try/d" }).body, /phone line/);
assert.match(buildEmail({ ...base, step: 2, tryUrl: "https://x/try/demo-1" }).body, /https:\/\/x\/try\/demo-1/);
const e3 = buildEmail({ ...base, step: 3, tryUrl: "https://x/try/demo-1" });
assert.equal(e3.subject.startsWith("Closing"), true, "step 3 unchanged");
const plain = buildEmail({ ...base, step: 1 });
assert.doesNotMatch(plain.body, /\/try\//);
assert.match(plain.body, /https:\/\/x\/demo/);
// honesty: never claims a relationship, results, or that the prospect asked
for (const e of [e1, plain]) assert.doesNotMatch(e.body, /as you requested|you asked|guarantee|increase your/i);
console.log("demo tests: all passed");
