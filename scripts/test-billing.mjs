import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifyFreemiusSignature, extractBuyerEmail, statusForEvent } from "../lib/billing/freemius.ts";

const secret = "sk_test_123"; const body = JSON.stringify({ id: "1", type: "payment.created" });
const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
assert.equal(verifyFreemiusSignature(body, sig, secret), true);
assert.equal(verifyFreemiusSignature(body + " ", sig, secret), false);   // tampered body
assert.equal(verifyFreemiusSignature(body, sig, "other"), false);        // wrong key
assert.equal(verifyFreemiusSignature(body, null, secret), false);        // missing header
assert.equal(verifyFreemiusSignature(body, "not-hex!!", secret), false); // garbage header

// buyer email: prefers the `user` object over other emails
assert.equal(extractBuyerEmail({ objects: { user: { email: "Owner@Clinic.com" }, seller: { email: "me@aixsystems.app" } } }), "owner@clinic.com");
assert.equal(extractBuyerEmail({ a: { b: { email: "x@y.io" } } }), "x@y.io");
assert.equal(extractBuyerEmail({ nothing: "here" }), undefined);

assert.equal(statusForEvent("payment.created"), "active");
assert.equal(statusForEvent("subscription.cancelled"), "cancelled");
assert.equal(statusForEvent("subscription.renewal.failed.last"), "past_due");
assert.equal(statusForEvent("payment.refund"), "refunded");
assert.equal(statusForEvent("user.name.changed"), undefined);
console.log("billing tests: all passed");
