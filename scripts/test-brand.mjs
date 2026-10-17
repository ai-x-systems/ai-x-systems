import assert from "node:assert/strict";
import { normalizeHex, hexToRgb, relLuminance, contrastWithWhite, shade, ensureWhiteContrast, hexToHsl, resolveBrand, DEFAULT_BRAND } from "../lib/config/brand.ts";
import { extractBrandColor } from "../lib/onboarding/site-facts.ts";
import { resolveHeadline, resolveSubtitle, resolveSuggestions } from "../lib/config/greetings.ts";

// only well-formed colours get through; everything else is rejected
assert.equal(normalizeHex("#C8102E"), "#c8102e");
assert.equal(normalizeHex("c8102e"), "#c8102e");
assert.equal(normalizeHex("#abc"), "#aabbcc");
assert.equal(normalizeHex("abc"), undefined, "a bare 3-letter code is not a colour");
assert.equal(normalizeHex("bad"), undefined, "a word made of hex letters is not a colour");
assert.equal(normalizeHex("fee"), undefined);
for (const bad of ["", undefined, null, "red", "#12", "#12345g", "#1234567", "javascript:alert(1)", "#fff;background:url(x)", "rgb(1,2,3)"]) assert.equal(normalizeHex(bad), undefined, String(bad));
assert.deepEqual(hexToRgb("#0a141e"), [10, 20, 30]);

// contrast: white text must stay readable on whatever colour an owner picks
assert.ok(contrastWithWhite("#ffffff") < 1.1);
assert.ok(contrastWithWhite("#000000") > 20);
assert.ok(relLuminance("#ffffff") > relLuminance("#808080"));
const yellow = ensureWhiteContrast("#ffe600");
assert.ok(contrastWithWhite(yellow) >= 4.5, "light yellow gets darkened until white text is readable");
assert.equal(ensureWhiteContrast("#c8102e"), "#c8102e", "an already-dark brand colour is left alone");
assert.ok(contrastWithWhite("#c8102e") >= 4.5);
assert.ok(relLuminance(shade("#4f46e5", -0.3)) < relLuminance("#4f46e5"));
assert.ok(relLuminance(shade("#4f46e5", 0.3)) > relLuminance("#4f46e5"));
assert.equal(hexToHsl("#808080").s, 0);

// resolveBrand: default keeps the existing AI x Systems look; a custom colour is safe and gets a darker end
assert.deepEqual(resolveBrand({}), { from: DEFAULT_BRAND.from, to: DEFAULT_BRAND.to, custom: false });
assert.deepEqual(resolveBrand({ chat: { brandColor: "not a colour" } }), { from: DEFAULT_BRAND.from, to: DEFAULT_BRAND.to, custom: false });
const b = resolveBrand({ chat: { brandColor: "#C8102E" } });
assert.equal(b.from, "#c8102e"); assert.equal(b.custom, true); assert.ok(relLuminance(b.to) < relLuminance(b.from));
assert.ok(contrastWithWhite(resolveBrand({ chat: { brandColor: "#ffff00" } }).from) >= 4.5);

// detecting a website's brand colour
assert.equal(extractBrandColor('<meta name="theme-color" content="#0b6e4f">'), "#0b6e4f");
assert.equal(extractBrandColor('<meta content="#C8102E" name="theme-color">'), "#c8102e");
assert.equal(extractBrandColor('<meta name="theme-color" content="#ffffff"><style>.a{color:#2a6fdb}.b{color:#2a6fdb}</style>'), "#2a6fdb", "a white theme-color is skipped");
const css = ":root{--primary:#c8102e;--bg:#fff} a{color:#c8102e} .t{color:#333} .u{color:#2a6fdb} body{background:#ffffff;color:#111}";
assert.equal(extractBrandColor("<html></html>", [css]), "#c8102e");
assert.equal(extractBrandColor("<style>.a{color:#2a6fdb}.b{color:#2a6fdb}.c{color:#c8102e}</style>"), "#2a6fdb", "most-used saturated colour wins");
assert.equal(extractBrandColor("<style>body{color:#222;background:#fff}.x{color:#888}</style>"), undefined, "greys and whites are never a brand colour");
assert.equal(extractBrandColor("<script>var c='#ff0000'</script><p>no styles</p>"), undefined, "script contents are ignored");
assert.equal(extractBrandColor('<div style="color:rgb(200,16,46)">x</div>'), "#c8102e");

// chat window copy
const base = { name: "Paragon Service Pros", voice: { assistantName: "Ava" } };
assert.equal(resolveHeadline(base), "Welcome to Paragon Service Pros");
assert.match(resolveSubtitle(base), /Ava is our virtual assistant/);
assert.equal(resolveHeadline({ ...base, chat: { headline: "  Need AC help fast?  " } }), "Need AC help fast?");
assert.deepEqual(resolveSuggestions({ ...base, knowledge: { services: [{}] } }), ["What services do you offer?", "What are your hours?", "I'd like someone to contact me"]);
assert.deepEqual(resolveSuggestions({ ...base, hoursKnown: false, knowledge: { services: [{}] } }), ["What services do you offer?", "I'd like someone to contact me"], "never suggests asking hours the assistant does not know");
assert.deepEqual(resolveSuggestions(base), ["What are your hours?", "I'd like someone to contact me"]);
assert.deepEqual(resolveSuggestions({ ...base, chat: { suggestions: ["Book a repair", "  ", "Pricing?", "a", "b", "c"] } }), ["Book a repair", "Pricing?", "a", "b"], "custom list: blanks dropped, max 4");
console.log("brand tests: all passed");

// ── owner edits: untrusted input is cleaned before it is stored or rendered ──
import { sanitizeChat, mergeChat } from "../lib/config/chat-settings.ts";
{
  const s = sanitizeChat({ brandColor: "C8102E", headline: "  Need AC   help fast?  ", subtitle: "", greeting: "x".repeat(900), bubble: "👋 hi", suggestions: "Book a repair\n \nPricing?\na\nb\nc" });
  assert.equal(s.brandColor, "#c8102e");
  assert.equal(s.headline, "Need AC help fast?");
  assert.equal("subtitle" in s, false, "a blank field means 'use the default'");
  assert.equal(s.greeting.length, 400, "length capped");
  assert.deepEqual(s.suggestions, ["Book a repair", "Pricing?", "a", "b"]);
  // hostile or malformed values never survive
  assert.equal("brandColor" in sanitizeChat({ brandColor: "red;background:url(//evil)" }), false);
  assert.equal("brandColor" in sanitizeChat({ brandColor: "<script>" }), false);
  assert.deepEqual(sanitizeChat(null), {});
  assert.deepEqual(sanitizeChat("nope"), {});
  assert.deepEqual(sanitizeChat({ suggestions: [1, {}, "ok"] }), { suggestions: ["ok"] });
  // merging: the override wins only where it has a value
  assert.deepEqual(mergeChat({ headline: "Base", brandColor: "#111111" }, { headline: "Mine" }), { headline: "Mine", brandColor: "#111111" });
  assert.deepEqual(mergeChat({ headline: "Base" }, {}), { headline: "Base" });
  assert.equal(mergeChat(undefined, undefined), undefined);
  assert.deepEqual(mergeChat(undefined, { brandColor: "#c8102e" }), { brandColor: "#c8102e" });
  assert.deepEqual(mergeChat({ headline: "Base" }, { headline: "", brandColor: "bad" }), { headline: "Base" }, "blank or invalid override values never wipe the base");
}
{
  const { applyOverride } = await import("../lib/config/overrides.ts");
  const base = { id: "x", knowledge: { faqs: [{ question: "q", answer: "a" }] }, integrations: { notifyEmail: "a@b.co" }, chat: { headline: "Base" } };
  const out = applyOverride(base, { chat: { brandColor: "#c8102e" } });
  assert.deepEqual(out.chat, { headline: "Base", brandColor: "#c8102e" });
  assert.deepEqual(out.knowledge.faqs, base.knowledge.faqs, "FAQs untouched when only appearance changes");
  assert.equal(applyOverride(base, null), base);
  assert.deepEqual(applyOverride(base, { notifyEmail: "z@y.co" }).chat, { headline: "Base" });
}
console.log("owner edit tests: all passed");
