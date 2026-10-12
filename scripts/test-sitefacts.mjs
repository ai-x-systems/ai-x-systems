import assert from "node:assert/strict";
import { extractJsonLdFacts, parseSchemaOpeningHours, compressDayRanges, extractHoursFromText, pickRelevantText, discoverLinks, extractMeta } from "../lib/onboarding/site-facts.ts";
import { parseHours } from "../lib/onboarding/build-config.ts";

// ── JSON-LD: openingHoursSpecification
const ld1 = `<html><head><script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org", "@type": "HVACBusiness", name: "Desert Air Pros", telephone: "+1 602-555-0100",
  address: { "@type": "PostalAddress", streetAddress: "12 Main St", addressLocality: "Tempe", addressRegion: "AZ", postalCode: "85282" },
  openingHoursSpecification: [
    { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "08:00", closes: "17:00" },
    { "@type": "OpeningHoursSpecification", dayOfWeek: "https://schema.org/Saturday", opens: "09:00", closes: "13:00" },
  ],
  makesOffer: [{ itemOffered: { name: "AC repair" } }, { itemOffered: { name: "AC installation" } }],
})}</script></head><body>x</body></html>`;
const f1 = extractJsonLdFacts(ld1);
assert.equal(f1.name, "Desert Air Pros");
assert.equal(f1.phone, "+1 602-555-0100");
assert.equal(f1.address, "12 Main St, Tempe, AZ, 85282");
assert.deepEqual(f1.hoursLines, ["Mon-Fri 08:00-17:00", "Sat 09:00-13:00"]);
assert.deepEqual(f1.services, ["AC repair", "AC installation"]);
const h1 = parseHours(f1.hoursLines.join("\n"));
assert.deepEqual(h1.wednesday, { open: "08:00", close: "17:00" });
assert.deepEqual(h1.saturday, { open: "09:00", close: "13:00" });
assert.equal(h1.sunday.closed, true);

// ── JSON-LD: @graph + openingHours strings, 24:00 close, malformed block ignored
const ld2 = `<script type="application/ld+json">{ not json </script><script type="application/ld+json">${JSON.stringify({ "@graph": [{ "@type": "WebSite", name: "x" }, { "@type": "Plumber", name: "Rapid Rooter", openingHours: ["Mo-Fr 07:00-18:00", "Sa,Su 00:00-24:00"] }] })}</script>`;
const f2 = extractJsonLdFacts(ld2);
assert.deepEqual(f2.hoursLines, ["Mon-Fri 07:00-18:00", "Sat-Sun 24 hours"]);
assert.deepEqual(parseHours(f2.hoursLines.join("\n")).sunday, { open: "00:00", close: "23:59" });
assert.deepEqual(extractJsonLdFacts("<html>no structured data</html>").hoursLines, []);
assert.deepEqual(parseSchemaOpeningHours("Mo,We,Fr 09:00-12:00").map((e) => e.day), [0, 2, 4]);
assert.deepEqual(compressDayRanges([{ day: 0, range: "a" }, { day: 1, range: "a" }, { day: 3, range: "a" }]), ["Mon-Tue a", "Thu a"]);

// ── hours in plain text
assert.deepEqual(extractHoursFromText("Hours of operation: Monday - Friday 8:00 AM - 5:00 PM. Saturday 9am to 1pm."), ["Mon-Fri 8:00am-5:00pm", "Sat 9am-1pm"]);
assert.deepEqual(extractHoursFromText("Monday: 9am-5pm Tuesday: 9am-5pm Sunday: Closed"), ["Mon 9am-5pm", "Tue 9am-5pm"]);
assert.deepEqual(extractHoursFromText("We are open 24 hours, 7 days a week for emergencies"), ["Open 24 hours"]);
assert.deepEqual(extractHoursFromText("Mon 2-3 items per customer"), [], "must not treat a quantity as hours");
assert.deepEqual(extractHoursFromText("Call us any time"), []);
const t = parseHours(extractHoursFromText("Mon-Fri: 8:30am – 5pm").join("\n"));
assert.deepEqual(t.thursday, { open: "08:30", close: "17:00" });

// ── choosing text: hours buried deep in a long page still reach the AI
const nav = "Home About Menu Blog Careers ".repeat(300);
const deep = nav + " Our hours: Monday through Friday 7am to 4pm. " + nav + " We offer drain cleaning and water heater repair. ";
const picked = pickRelevantText(deep, 6000);
assert.ok(picked.length <= 6000);
assert.match(picked, /Monday through Friday 7am to 4pm/);
assert.match(picked, /drain cleaning/);

// ── links: same-site, relevant only
const home = `<a href="/contact-us">c</a><a href="https://other.com/contact">x</a><a href="/services/ac-repair#x">s</a><a href="/blog">b</a><a href="/files/menu.pdf">p</a><a href="mailto:a@b.com">m</a><a href="https://www.shop.com/about">a</a><a href="/contact-us?x=1">dup</a>`;
assert.deepEqual(discoverLinks(home, "https://shop.com"), ["https://shop.com/contact-us", "https://shop.com/services/ac-repair", "https://www.shop.com/about"]);
assert.deepEqual(discoverLinks("<a href='javascript:x()'>", "https://shop.com"), []);

// ── meta
const meta = extractMeta(`<title> Desert Air | HVAC  </title><meta name="description" content="Family-owned AC repair in Tempe">`);
assert.equal(meta.title, "Desert Air | HVAC");
assert.equal(meta.description, "Family-owned AC repair in Tempe");
console.log("site facts tests: all passed");
