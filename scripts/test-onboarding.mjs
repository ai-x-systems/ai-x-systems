// Run: npm run test:onboarding
import assert from "node:assert/strict";
import { buildBusinessConfig, parseHours, parseServices, parseFaqs, slugify, generatePassword } from "../lib/onboarding/build-config.ts";

assert.equal(slugify("Bright Smile Dental, LLC!"), "bright-smile-dental-llc");
assert.equal(slugify("!!!"), "client");

const h = parseHours("Mon-Fri 9am-5pm\nSat 10:00-14:00\nSun closed");
assert.deepEqual(h.monday, { open: "09:00", close: "17:00" });
assert.deepEqual(h.friday, { open: "09:00", close: "17:00" });
assert.deepEqual(h.saturday, { open: "10:00", close: "14:00" });
assert.equal(h.sunday.closed, true);
assert.deepEqual(parseHours("Mon-Sat 9-5").saturday, { open: "09:00", close: "17:00" });
assert.deepEqual(parseHours("Tue 8am-12pm").tuesday, { open: "08:00", close: "12:00" });
assert.equal(parseHours("Tue 8am-12pm").monday.closed, true);       // unmentioned = closed
assert.deepEqual(parseHours("").wednesday, { open: "09:00", close: "17:00" }); // empty = Mon-Fri 9-5
assert.equal(parseHours("").saturday.closed, true);

const svc = parseServices("Cleaning | $120 | 45 | Standard cleaning\nCleaning\nWhitening");
assert.equal(svc.length, 3);
assert.equal(svc[0].price, "$120"); assert.equal(svc[0].durationMinutes, 45);
assert.equal(new Set(svc.map((s) => s.id)).size, 3, "ids must be unique");

const faqs = parseFaqs("Do you take insurance? | Yes, most PPO plans.\nnot a faq line\n | missing question");
assert.deepEqual(faqs, [{ question: "Do you take insurance?", answer: "Yes, most PPO plans." }]);

const cfg = buildBusinessConfig({ name: "Bright Smile Dental", industry: "Dentist", notifyEmail: "front@bright.com", hoursText: "Mon-Fri 8-4", servicesText: "Exam | $80 | 30", faqsText: "Parking? | Free lot behind the clinic." }, "bright-smile-dental");
assert.equal(cfg.booking.enabled, false);
assert.equal(cfg.demo, false);
assert.equal(cfg.knowledge.services[0].id, "exam");
assert.equal(cfg.integrations.notifyEmail, "front@bright.com");
assert.equal(cfg.hours.monday.close, "16:00");
assert.throws(() => buildBusinessConfig({ name: "X", industry: "Y", notifyEmail: "a@b.co", tone: "rude" }, "x"));

const p = generatePassword(); assert.equal(p.length, 16); assert.notEqual(p, generatePassword());
console.log("onboarding tests: all passed");
