import assert from "node:assert/strict";
import { scopedToken, authorizeVoice, normalizeE164, billedMinutes, maxCallSeconds, parseToolCalls, extractDurationSeconds, extractCostCents, extractCalledNumber, extractCaller, minutesForPayment, parsePacks } from "../lib/voice/pure.ts";

const S = "master-secret";
// auth
assert.deepEqual(authorizeVoice(S, { xVapiSecret: S }), { level: "full" });
assert.deepEqual(authorizeVoice(S, { authorization: `Bearer ${S}` }), { level: "full" });
assert.deepEqual(authorizeVoice(S, { k: S }), { level: "full" });
assert.deepEqual(authorizeVoice(S, { b: "acme", t: scopedToken(S, "acme") }), { level: "scoped", businessId: "acme" });
assert.equal(authorizeVoice(S, { b: "acme", t: scopedToken(S, "other") }).level, "none", "token is bound to its business");
assert.equal(authorizeVoice(S, { xVapiSecret: "nope" }).level, "none");
assert.equal(authorizeVoice(undefined, { xVapiSecret: "x" }).level, "none", "no configured secret = deny all");
assert.equal(authorizeVoice(S, {}).level, "none");

// numbers
assert.equal(normalizeE164("(512) 555-0123"), "+15125550123");
assert.equal(normalizeE164("+1 512 555 0123"), "+15125550123");
assert.equal(normalizeE164("15125550123"), "+15125550123");
assert.equal(normalizeE164("+44 20 7946 0958"), "+442079460958");
assert.equal(normalizeE164("abc"), undefined);
assert.equal(normalizeE164(undefined), undefined);

// billing
assert.equal(billedMinutes(0), 0); assert.equal(billedMinutes(4), 0);
assert.equal(billedMinutes(5), 1); assert.equal(billedMinutes(60), 1); assert.equal(billedMinutes(61), 2); assert.equal(billedMinutes(600), 10);
assert.equal(billedMinutes(NaN), 0);
for (const bal of [1, 2, 7, 30]) { const cap = maxCallSeconds(bal, 900); assert.ok(billedMinutes(cap) <= bal, `cap for ${bal}`); }
assert.equal(maxCallSeconds(100, 900), 900);   // hard cap wins
assert.equal(maxCallSeconds(3, 900), 180);     // balance wins
assert.equal(maxCallSeconds(0, 900), 60);      // floor

// tool calls: both payload shapes
const a = parseToolCalls({ toolCallList: [{ id: "1", type: "function", function: { name: "log_lead", arguments: { callerName: "Sam" } } }] });
assert.deepEqual(a, [{ id: "1", name: "log_lead", args: { callerName: "Sam" } }]);
const b = parseToolCalls({ toolCallList: [{ id: "2", name: "log_lead", parameters: { callerEmail: "a@b.co" } }] });
assert.deepEqual(b, [{ id: "2", name: "log_lead", args: { callerEmail: "a@b.co" } }]);
const c = parseToolCalls({ toolCallList: [{ id: "3", function: { name: "book_appointment", arguments: "{\"callerName\":\"Li\"}" } }, { junk: true }, { id: "4" }] });
assert.deepEqual(c, [{ id: "3", name: "book_appointment", args: { callerName: "Li" } }]);
assert.deepEqual(parseToolCalls({}), []);

// duration/cost
assert.equal(extractDurationSeconds({ durationSeconds: 61.4 }), 61);
assert.equal(extractDurationSeconds({ call: { durationMs: 90000 } }), 90);
assert.equal(extractDurationSeconds({ startedAt: "2026-09-30T10:00:00Z", endedAt: "2026-09-30T10:02:30Z" }), 150);
assert.equal(extractDurationSeconds({ call: { startedAt: "2026-09-30T10:00:00Z", endedAt: "2026-09-30T10:00:45Z" } }), 45);
assert.equal(extractDurationSeconds({}), 0);
assert.equal(extractCostCents({ cost: 0.1234 }), 12.34);
assert.equal(extractCostCents({ call: { cost: 0.5 } }), 50);
assert.equal(extractCostCents({}), undefined);

// numbers from payload
assert.equal(extractCalledNumber({ phoneNumber: { number: "+15125550123" } }), "+15125550123");
assert.equal(extractCalledNumber({ call: { phoneNumber: { number: "(512) 555-0123" } } }), "+15125550123");
assert.equal(extractCaller({ customer: { number: "+14155550100" } }), "+14155550100");
assert.equal(extractCaller({ call: { customer: { number: "+14155550101" } } }), "+14155550101");

// minute packs
const packs = parsePacks('{"111": 100, "222": 500, "bad": -5, "x": "y"}');
assert.deepEqual(packs, { "111": 100, "222": 500 });
assert.equal(minutesForPayment({ objects: { payment: { plan_id: 111 } } }, packs), 100);
assert.equal(minutesForPayment({ objects: { subscription: { pricing_id: "222" } } }, packs), 500);
assert.equal(minutesForPayment({ objects: { payment: { plan_id: 999 } } }, packs), 0, "unknown plan credits nothing");
assert.equal(minutesForPayment({}, packs), 0);
assert.deepEqual(parsePacks("not json"), {});
console.log("voice tests: all passed");
