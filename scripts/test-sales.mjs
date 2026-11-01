import assert from "node:assert/strict";
import { eventToPayment, summarizeSales, addMonth } from "../lib/billing/sales.ts";
import { isSafeWebhookUrl, sheetIdFrom } from "../lib/integrations/url-guard.ts";

const ev = (type, business_id, created_at, payload, email = "c@x.com") => ({ type, business_id, created_at, payload, email });
const sub = (id, reason, total, at, biz = "acme") => ev("whop.payment.succeeded", biz, at, { type: "payment.succeeded", data: { id, total, billing_reason: reason, plan: { id: "plan_cjXCgAuwSjXAJ" } } });
const pack = (id, total, planId, at, biz = "acme") => ev("whop.payment.succeeded", biz, at, { type: "payment.succeeded", data: { id, total, plan: { id: planId } } });

// first payment splits into setup + first month; renewal is monthly only
let p = eventToPayment(sub("p1", "subscription_create", 348, "2026-10-01T10:00:00Z"));
assert.equal(p.kind, "setup"); assert.equal(p.setup, 199); assert.equal(p.amount, 348);
p = eventToPayment(sub("p2", "subscription_cycle", 149, "2026-11-01T10:00:00Z"));
assert.equal(p.kind, "monthly"); assert.equal(p.setup, 0);
p = eventToPayment(pack("p3", 50, "plan_YsoxfGM8340y3", "2026-10-05T10:00:00Z"));
assert.equal(p.kind, "minutes"); assert.equal(p.note, "200-minute pack");
assert.equal(eventToPayment(ev("whop.payment.failed", "acme", "2026-10-05T10:00:00Z", {})), null);
assert.equal(eventToPayment(ev("whop.refund.created", "acme", "2026-10-05T10:00:00Z", {})), null);

// manual payments
p = eventToPayment(ev("manual.payment", "acme", "2026-10-02T00:00:00Z", { amount: 199, plan: "founding", note: "Paid by bank", paidAt: "2026-10-02T00:00:00Z" }));
assert.equal(p.manual, true); assert.equal(p.setup, 199);

// summary
const lines = [
  sub("p1", "subscription_create", 348, "2026-10-01T10:00:00Z"),
  sub("p2", "subscription_cycle", 149, "2026-11-01T10:00:00Z"),
  pack("p3", 50, "plan_YsoxfGM8340y3", "2026-11-03T10:00:00Z"),
  pack("p4", 110, "plan_7BojRTibaBUhe", "2026-11-04T10:00:00Z", null),
].map((r) => eventToPayment(r));
const s = summarizeSales(lines, new Date("2026-11-15T00:00:00Z"));
assert.equal(s.totals.revenue, 657);
assert.equal(s.totals.thisMonth, 309);
assert.equal(s.totals.setup, 199);
assert.equal(s.totals.subscription, 298);
assert.equal(s.totals.minutes, 160);
assert.equal(s.unmatched.length, 1);
const c = s.perClient.get("acme");
assert.equal(c.plan, "founding"); assert.equal(c.setupPaid, 199); assert.equal(c.subscriptionPaid, 298); assert.equal(c.minutesPaid, 50); assert.equal(c.totalPaid, 547);
assert.equal(c.firstPaidAt, "2026-10-01T10:00:00Z");
assert.equal(c.nextRenewalEstimate.slice(0, 10), "2026-12-01");

// month-end renewal never skips into the next month
assert.equal(addMonth("2026-01-31T00:00:00Z").slice(0, 10), "2026-02-28");

// webhook URL guard
for (const ok of ["https://hooks.zapier.com/hooks/catch/1/abc", "https://hook.make.com/x", "https://example.com/a?b=1"]) assert.equal(isSafeWebhookUrl(ok), true, ok);
for (const bad of ["http://hooks.zapier.com/x", "https://localhost/x", "https://127.0.0.1/x", "https://10.0.0.5/x", "https://169.254.169.254/latest", "https://[::1]/x", "https://intranet/x", "https://x.internal/x", "https://user:pw@example.com/x", "https://example.com:8443/x", "javascript:alert(1)", "", null, "not a url"]) assert.equal(isSafeWebhookUrl(bad), false, String(bad));

// pasted Google Sheet link or id
const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abc";
assert.equal(sheetIdFrom(`https://docs.google.com/spreadsheets/d/${id}/edit#gid=0`), id);
assert.equal(sheetIdFrom(id), id);
assert.equal(sheetIdFrom("hello"), "");
assert.equal(sheetIdFrom("https://example.com/x"), "");

console.log("sales tests: all passed");
