// Run: SESSION_SECRET=x node scripts/test-growth.mjs
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { extractBestEmail, detectSignals, isSafePublicUrl, openerIsSafe, buildEmail, unsubscribeToken, verifyUnsubscribeToken, verifySvix, scoreLead } from "../lib/growth/pure.ts";

// email extraction: prefers same-domain role address, ignores junk
const html = `<a href="mailto:info@smilecare.com">x</a> noreply@smilecare.com photo@2x.png you@example.com user@sentry.io dr.jones@gmail.com`;
assert.equal(extractBestEmail(html, "https://www.smilecare.com/"), "info@smilecare.com");
assert.equal(extractBestEmail("nothing here"), undefined);
assert.equal(extractBestEmail("contact&#64;acme.org", "https://acme.org"), "contact@acme.org");

// signals
assert.equal(detectSignals("<script src='https://widget.intercom.io'>").chatWidget, true);
assert.equal(detectSignals("<p>hello</p>").chatWidget, false);

// SSRF guard
for (const bad of ["http://localhost", "http://127.0.0.1", "http://10.0.0.5", "http://169.254.169.254", "http://192.168.1.1", "ftp://x.com", "http://intranet"])
  assert.equal(isSafePublicUrl(bad), null, bad);
assert.ok(isSafePublicUrl("acme.com"));

// opener guard
assert.equal(openerIsSafe("I noticed Acme Dental in Austin and wanted to ask how you handle enquiries after hours.", ["Acme Dental", "Austin"]), true);
assert.equal(openerIsSafe("Love what you do, amazing clinic!", []), false);
assert.equal(openerIsSafe("Your 300 reviews are impressive and I saw a link https://x.com for you", ["Acme"]), false);
assert.equal(openerIsSafe("We can boost your revenue by 40 percent for Acme Dental this quarter easily", ["Acme"]), false);

// templates: honest + include CTA, never claim results
const e = buildEmail({ businessName: "Acme Dental", industry: "dentist", city: "Austin", step: 1, senderName: "Alex", demoUrl: "https://x/demo", offer: "chat" });
assert.match(e.body, /https:\/\/x\/demo/); assert.doesNotMatch(e.body, /phone|calls/i);
assert.match(buildEmail({ businessName: "A", step: 1, senderName: "Al", demoUrl: "u", offer: "voice" }).body, /picks up|caller/);
assert.equal(buildEmail({ businessName: "A", step: 3, senderName: "Al", demoUrl: "u", offer: "chat" }).subject.startsWith("Should I close the file"), true);

// unsubscribe tokens
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test";
const t = unsubscribeToken("lead-1");
assert.equal(verifyUnsubscribeToken("lead-1", t), true);
assert.equal(verifyUnsubscribeToken("lead-2", t), false);
assert.equal(verifyUnsubscribeToken("lead-1", "bad"), false);

// svix signature
const key = crypto.randomBytes(24); const whsec = "whsec_" + key.toString("base64");
const body = JSON.stringify({ type: "email.bounced" }); const id = "msg_1"; const ts = String(Math.floor(Date.now() / 1000));
const sig = "v1," + crypto.createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
assert.equal(verifySvix(body, { id, timestamp: ts, signature: sig }, whsec), true);
assert.equal(verifySvix(body + "x", { id, timestamp: ts, signature: sig }, whsec), false);
assert.equal(verifySvix(body, { id, timestamp: String(Number(ts) - 1000), signature: sig }, whsec), false);

assert.ok(scoreLead({ reviewCount: 250, rating: 4.6, phone: "1", chatWidget: false }) > scoreLead({ reviewCount: 3 }));
console.log("growth tests: all passed");

// ── hand-entered leads ──
import { parseManualLeads } from "../lib/growth/pure.ts";
{
  const r = parseManualLeads(`brightsmile.com | Bright Smile Dental
https://www.acmeplumbing.com/contact
cityhvac.net | City HVAC | OFFICE@CityHVAC.net
http://localhost
192.168.1.5
not a site
brightsmile.com | Duplicate
goodco.com | Good Co | not-an-email

   `);
  assert.deepEqual(r.leads.map((l) => l.host), ["brightsmile.com", "acmeplumbing.com", "cityhvac.net"]);
  assert.equal(r.leads[0].name, "Bright Smile Dental");
  assert.equal(r.leads[1].name, "Acmeplumbing", "name falls back to the domain");
  assert.equal(r.leads[1].website, "https://www.acmeplumbing.com", "keeps the site origin only");
  assert.equal(r.leads[2].email, "office@cityhvac.net", "email lower-cased");
  assert.equal(r.rejected.length, 5);
  assert.ok(r.rejected.some((x) => /Duplicate/.test(x.reason)));
  assert.ok(r.rejected.some((x) => /email/.test(x.reason)));
  assert.equal(parseManualLeads("a.com\nb.com\nc.com", 2).leads.length, 2, "respects the per-paste cap");
  assert.equal(parseManualLeads("").leads.length, 0);
  assert.equal(parseManualLeads("a.com\tTab Name\tx@a.com").leads[0].email, "x@a.com", "tab-separated works");
  console.log("manual lead tests: all passed");
}

// ── outcome-first copy ──
import { hoursFacts, industryProfile, yearlyExample, shortName, chooseHook } from "../lib/growth/copy.ts";
{
  const wk = (open, close) => ({ open, close, closed: false });
  const closed = { open: "", close: "", closed: true };
  const nineToFive = { monday: wk("08:00", "17:00"), tuesday: wk("08:00", "17:00"), wednesday: wk("08:00", "17:00"), thursday: wk("08:00", "17:00"), friday: wk("08:00", "17:00"), saturday: closed, sunday: closed };
  assert.deepEqual(hoursFacts(nineToFive, true), { hoursKnown: true, weekdayOpen: "8am", weekdayClose: "5pm", closesEarly: true, weekendClosed: true });
  assert.deepEqual(hoursFacts(nineToFive, false), { hoursKnown: false });
  assert.deepEqual(hoursFacts(undefined, true), { hoursKnown: false });
  const allDay = Object.fromEntries(Object.keys(nineToFive).map((d) => [d, wk("00:00", "23:59")]));
  assert.equal(hoursFacts(allDay, true).closesEarly, false, "open all day is not an early close");
  const lateShop = { ...nineToFive, monday: wk("09:00", "19:00"), tuesday: wk("09:00", "19:00"), wednesday: wk("09:00", "19:00"), thursday: wk("09:00", "19:00"), friday: wk("09:00", "19:00") };
  assert.equal(hoursFacts(lateShop, true).closesEarly, false);

  // money maths is round, conservative and exact
  assert.equal(yearlyExample(450), 46800);
  assert.equal(yearlyExample(250), 26000);
  for (const t of ["hvac", "Plumber", "dentist", "law firm", "roofing", "electrician", "bakery", undefined]) {
    const p = industryProfile(t);
    assert.ok(p.value > 0 && p.scenario && p.valueLabel && p.plural, String(t));
  }
  assert.equal(industryProfile("bakery").plural, "local businesses");

  // short names for subject lines
  assert.equal(shortName("Smile Dental"), "Smile Dental");
  assert.equal(shortName("Hansen Family Air Conditioning & Plumbing"), "Hansen Family");
  assert.equal(shortName("Reliance Heating & Air Conditioning"), "Reliance");

  // the strongest honest observation wins
  const o = { short: "Acme", offer: "voice" };
  assert.equal(chooseHook({ hoursKnown: true, closesEarly: true, weekdayClose: "5pm", claims247: true }, o).key, "hours247");
  assert.equal(chooseHook({ hoursKnown: true, closesEarly: true, weekdayClose: "5pm" }, o).key, "hours");
  assert.equal(chooseHook({ hoursKnown: false, phoneOnly: true, reviewCount: 120, rating: 4.8 }, o).key, "phoneOnly");
  assert.equal(chooseHook({ hoursKnown: false, reviewCount: 120, rating: 4.8 }, o).key, "reviews");
  assert.equal(chooseHook({ hoursKnown: false, reviewCount: 10, rating: 5, noChat: true }, o).key, "noChat");
  assert.equal(chooseHook({ hoursKnown: false }, o).key, "generic");
  assert.equal(chooseHook({ hoursKnown: true, closesEarly: false, claims247: true }, o).key, "generic", "no early close, so there is no gap to point at");

  // the full email: problem, money, outcome, proof, low-friction ask; and nothing we can't stand behind
  const facts = { ...hoursFacts(nineToFive, true), claims247: false, phoneOnly: true, noChat: true };
  const base = { businessName: "Hansen Family Air Conditioning & Plumbing", industry: "HVAC contractor", city: "Phoenix AZ", senderName: "Alex", demoUrl: "https://x/demo", tryUrl: "https://x/try/demo-abc", offer: "voice", facts };
  const s1 = buildEmail({ ...base, step: 1 });
  assert.equal(s1.subject, "Hansen Family: calls after 5pm");
  assert.match(s1.body, /Your website lists 8am-5pm on weekdays and no weekend hours/);
  assert.match(s1.body, /next company on Google/);
  assert.match(s1.body, /Rough math with round numbers \(swap in yours\)/);
  assert.match(s1.body, /\$450/); assert.match(s1.body, /\$46,800 a year/);
  assert.match(s1.body, /name, number and what they need/);
  assert.match(s1.body, /https:\/\/x\/try\/demo-abc/);
  assert.match(s1.body, /reply "show me"/i);
  assert.match(s1.body, /AI assistant/, "say plainly that it is AI");
  const words = s1.body.trim().split(/\s+/).length;
  assert.ok(words >= 90 && words <= 190, `step 1 is ${words} words`);
  for (const banned of [/guarantee/i, /100%/, /#1/, /case stud/i, /^re:/i, /AI receptionist/i, /chatbot/i, /chat widget/i, /limited spots|only \d+ left/i]) assert.doesNotMatch(s1.body + " " + s1.subject, banned, String(banned));

  const s2 = buildEmail({ ...base, step: 2 });
  assert.doesNotMatch(s2.subject, /^re:/i, "no fake reply threads");
  assert.match(s2.body, /AC dies at 9pm/); assert.match(s2.body, /who covers the phones at Hansen Family after 5pm/);
  const s3 = buildEmail({ ...base, step: 3 });
  assert.doesNotMatch(s3.body, /, The |, If you/, "no capital letter in the middle of a sentence"); assert.match(s3.subject, /close the file/i); assert.match(s3.body, /stays live/); assert.match(s3.body, /https:\/\/x\/try\/demo-abc/);

  // chat-only offer never talks about phones; a missing preview falls back to the request page
  const chat = buildEmail({ ...base, offer: "chat", tryUrl: undefined, step: 1 });
  assert.doesNotMatch(chat.body, /phone|calls\b/i);
  assert.match(chat.body, /https:\/\/x\/demo/);
  assert.equal(chat.subject, "Hansen Family: website visitors after 5pm");

  // unknown hours say NOTHING about hours
  const unknown = buildEmail({ ...base, facts: { hoursKnown: false, phoneOnly: true }, step: 1 });
  assert.doesNotMatch(unknown.body, /Your website lists|weekdays/);
  assert.match(unknown.body, /couldn't find a way on your site/);
}
console.log("growth copy tests: all passed");
