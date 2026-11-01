import assert from "node:assert/strict";
import { classifyPlan, decideWhopAction, whopPlanIds, metadataBusinessId, paymentEmail, paymentPlanId, paymentId, formatAmount, membershipIdOf, WHOP_EVENTS, PRICING } from "../lib/billing/whop.ts";

const ids = whopPlanIds({});
assert.equal(ids.founding, "plan_cjXCgAuwSjXAJ");
assert.equal(whopPlanIds({ WHOP_PLAN_FOUNDING: "plan_new" }).founding, "plan_new", "env overrides a plan id");

// plan classification
assert.deepEqual(classifyPlan(ids.founding, ids), { key: "founding", kind: "subscription", minutes: 0 });
assert.deepEqual(classifyPlan(ids.standard, ids), { key: "standard", kind: "subscription", minutes: 0 });
assert.deepEqual(classifyPlan(ids.minutes200, ids), { key: "minutes200", kind: "minutes", minutes: 200 });
assert.deepEqual(classifyPlan(ids.minutes500, ids), { key: "minutes500", kind: "minutes", minutes: 500 });
assert.equal(classifyPlan("plan_other", ids).kind, "unknown");
assert.equal(classifyPlan(undefined, ids).kind, "unknown");

// payload readers (shape taken from Whop's Payment object)
const pay = (planId, extra = {}) => ({ id: "pay_1", total: 348, currency: "usd", plan: { id: planId }, user: { email: "Owner@Shop.com" }, metadata: { business_id: "acme" }, ...extra });
assert.equal(paymentId(pay(ids.founding)), "pay_1");
assert.equal(paymentPlanId(pay(ids.founding)), ids.founding);
assert.equal(metadataBusinessId(pay(ids.founding)), "acme");
assert.equal(metadataBusinessId({ metadata: null }), undefined);
assert.equal(paymentEmail(pay(ids.founding)), "owner@shop.com", "email is lower-cased");
assert.equal(formatAmount(pay(ids.founding)), "348.00 USD");
assert.equal(formatAmount(null), "unknown amount");

// subscription payment turns billing active, credits nothing
let d = decideWhopAction("payment.succeeded", pay(ids.founding), ids);
assert.equal(d.status, "active");
assert.equal(d.minutes, 0);
assert.ok(d.alert);

// minute packs credit exactly their size and do not touch billing status
d = decideWhopAction("payment.succeeded", pay(ids.minutes200, { total: 50 }), ids);
assert.equal(d.minutes, 200);
assert.equal(d.status, undefined);
d = decideWhopAction("payment.succeeded", pay(ids.minutes500, { total: 110 }), ids);
assert.equal(d.minutes, 500);

// an unknown plan changes nothing but still alerts
d = decideWhopAction("payment.succeeded", pay("plan_unknown"), ids);
assert.equal(d.status, undefined);
assert.equal(d.minutes, 0);
assert.ok(d.alert);

// a failed RENEWAL marks past due; a failed first checkout does not mark a new client past due
d = decideWhopAction("payment.failed", pay(ids.founding, { billing_reason: "subscription_cycle" }), ids);
assert.equal(d.status, "past_due");
d = decideWhopAction("payment.failed", pay(ids.founding, { billing_reason: "subscription_create" }), ids);
assert.equal(d.status, undefined);
d = decideWhopAction("payment.failed", pay(ids.minutes200, { billing_reason: "one_time" }), ids);
assert.equal(d.status, undefined);

// refunds and disputes only alert: never pause or change anything
for (const t of ["refund.created", "dispute.created"]) {
  d = decideWhopAction(t, pay(ids.founding), ids);
  assert.ok(d.alert);
  assert.equal(d.status, undefined);
  assert.equal(d.minutes, 0);
}

// anything else is ignored; garbage payloads never throw
// membership events: ending a subscription marks cancelled; scheduling a cancel only alerts
d = decideWhopAction("membership.deactivated", { id: "mem_1", status: "canceled" }, ids);
assert.equal(d.status, "cancelled");
assert.ok(d.alert);
d = decideWhopAction("membership.cancel_at_period_end_changed", { id: "mem_1", cancel_at_period_end: true }, ids);
assert.equal(d.status, undefined);
assert.ok(d.alert);
assert.equal(membershipIdOf("membership.deactivated", { id: "mem_9" }), "mem_9");
assert.equal(membershipIdOf("payment.succeeded", { id: "pay_1", membership: { id: "mem_7" } }), "mem_7");
assert.equal(membershipIdOf("payment.succeeded", { id: "pay_1" }), undefined);
assert.equal(PRICING.setup.founding + PRICING.monthly, 348);
assert.equal(PRICING.setup.standard + PRICING.monthly, 448);

d = decideWhopAction("membership.updated", pay(ids.founding), ids);
assert.equal(d.alert, false);
for (const bad of [null, undefined, 5, "x", [], {}]) {
  assert.doesNotThrow(() => decideWhopAction("payment.succeeded", bad, ids));
  assert.equal(decideWhopAction("payment.succeeded", bad, ids).minutes, 0);
}
assert.deepEqual([...WHOP_EVENTS], ["payment.succeeded", "payment.failed", "refund.created", "dispute.created", "membership.deactivated", "membership.cancel_at_period_end_changed"]);

console.log("whop billing tests: all passed");
