import assert from "node:assert/strict";
import { extractBuyerEmail } from "../lib/billing/status.ts";

// buyer email: prefers the `user` object over other emails
assert.equal(extractBuyerEmail({ objects: { user: { email: "Owner@Clinic.com" }, seller: { email: "me@aixsystems.app" } } }), "owner@clinic.com");
assert.equal(extractBuyerEmail({ a: { b: { email: "x@y.io" } } }), "x@y.io");
assert.equal(extractBuyerEmail({ nothing: "here" }), undefined);
assert.equal(extractBuyerEmail(null), undefined);
console.log("billing tests: all passed");
