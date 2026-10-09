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
assert.match(buildEmail({ businessName: "A", step: 1, senderName: "Al", demoUrl: "u", offer: "voice" }).body, /calls/);
assert.equal(buildEmail({ businessName: "A", step: 3, senderName: "Al", demoUrl: "u", offer: "chat" }).subject.startsWith("Closing"), true);

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
