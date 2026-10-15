import assert from "node:assert/strict";
import { defaultChatGreeting, defaultBubble, defaultPhoneGreeting, resolveChatGreeting, resolveBubble, resolvePhoneGreeting } from "../lib/config/greetings.ts";
import { buildBusinessConfig } from "../lib/onboarding/build-config.ts";
import { buildSystemPrompt } from "../lib/prompt/prompt-builder.ts";
import { readFileSync } from "node:fs";

const base = { name: "Bright Smile", voice: { assistantName: "Ava", greeting: "" } };

// defaults: warm, name the business and the assistant, and say it is virtual
assert.equal(defaultChatGreeting("Bright Smile", "Ava"), "Hi, thanks for reaching out to Bright Smile. I'm Ava, the virtual assistant. What can I help you with today?");
assert.match(defaultPhoneGreeting("Bright Smile", "Ava"), /Thanks for calling Bright Smile, this is Ava, the virtual assistant/);
assert.match(defaultBubble("Bright Smile"), /Bright Smile/);
assert.equal(resolveChatGreeting(base), defaultChatGreeting("Bright Smile", "Ava"));
assert.equal(resolveBubble(base), defaultBubble("Bright Smile"));

// a custom greeting is used, tidied up, and can never drop the disclosure
assert.equal(resolveChatGreeting({ ...base, chat: { greeting: "  Welcome!   I'm   Ava, the virtual assistant here. " } }), "Welcome! I'm Ava, the virtual assistant here.");
assert.equal(resolveChatGreeting({ ...base, chat: { greeting: "Welcome to Bright Smile! How can I help?" } }), "Welcome to Bright Smile! How can I help? I'm Ava, the virtual assistant.");
assert.equal(resolveChatGreeting({ ...base, chat: { greeting: "Hi, I'm the AI helper." } }), "Hi, I'm the AI helper.", "mentions AI: left alone");
assert.equal(resolveBubble({ ...base, chat: { bubble: "  Hello there  " } }), "Hello there");
assert.equal(resolveChatGreeting({ ...base, chat: { greeting: "   " } }), defaultChatGreeting("Bright Smile", "Ava"), "blank falls back to the default");
// phone: custom greeting only if it discloses; legacy "Thanks for contacting ..., this is Ava" without disclosure is replaced
assert.equal(resolvePhoneGreeting({ ...base, voice: { assistantName: "Ava", greeting: "Thanks for contacting Bright Smile, this is Ava \u2014 how can I help you today?" } }), defaultPhoneGreeting("Bright Smile", "Ava"));
assert.equal(resolvePhoneGreeting({ ...base, voice: { assistantName: "Ava", greeting: "Hi, Bright Smile, Ava here, the virtual assistant." } }), "Hi, Bright Smile, Ava here, the virtual assistant.");

// new clients and previews get a phone-appropriate greeting
const cfg = buildBusinessConfig({ name: "Rapid Rooter", industry: "Plumber", notifyEmail: "a@b.co" }, "rapid-rooter");
assert.match(cfg.voice.greeting, /^Thanks for calling Rapid Rooter, this is Ava, the virtual assistant/);

// AI x Systems' own copy: present, human, honest
const ax = JSON.parse(readFileSync(new URL("../data/businesses/ai-x-systems.json", import.meta.url), "utf8"));
for (const g of [ax.chat.greeting, ax.voice.greeting]) { assert.match(g, /virtual assistant/); assert.match(g, /AI x Systems/); }
assert.ok(ax.chat.greeting.length < 260, "chat greeting stays short enough to read at a glance");
assert.ok(ax.chat.bubble.length <= 160);
assert.equal(resolveChatGreeting(ax), ax.chat.greeting);
assert.equal(resolvePhoneGreeting(ax), ax.voice.greeting);

// the system prompt teaches a human but honest style
const p = buildSystemPrompt(cfg);
assert.match(p, /HOW TO SOUND/);
assert.match(p, /one question at a time/i);
assert.match(p, /Never claim to be a human/);
assert.match(p, /virtual receptionist for Rapid Rooter/);
assert.doesNotMatch(p, /AI phone receptionist/);
console.log("greeting tests: all passed");
