# Whop payments

Whop takes the money; this app reacts to the payment.

## Products and plans (already created in Whop)
| Plan | Whop product | First charge | Env override (optional) |
|---|---|---|---|
| Founding client (first 10) | AI Receptionist | $348 ($199 setup + first $149 month) | `WHOP_PLAN_FOUNDING` |
| Standard | AI Receptionist | $448 ($299 setup + first $149 month) | `WHOP_PLAN_STANDARD` |
| 200 minutes | Voice Minutes | $50 one-time | `WHOP_PLAN_MINUTES_200` |
| 500 minutes | Voice Minutes | $110 one-time | `WHOP_PLAN_MINUTES_500` |

Plan ids are not secrets; the defaults in `lib/billing/whop.ts` are your real ids.

## Vercel env vars
- `WHOP_API_KEY`: Whop dashboard > Developer > create an API key (company key). Needs permission to create checkout configurations (`checkout_configuration:create`) plus the payment/plan/member read permissions Whop lists for the payment webhook. **Sensitive: never expose it to the browser.**
- `WHOP_WEBHOOK_SECRET`: the `ws_...` secret shown after you create the webhook below.
- `WHOP_ACCOUNT_ID` (optional): your `biz_...` id, only if Whop asks for it when creating links.

## Webhook
Whop > Developer > Webhooks > Create webhook
- URL: `https://ai-x-systems.vercel.app/api/billing/whop`
- Events: `payment.succeeded`, `payment.failed`, `refund.created`, `dispute.created`
- Use the "send test event" button once; a test payment has no matching client, so you should see a "matched NO client" alert email, which proves signature + delivery work.

## What happens
- **/admin > a client row > "Payment link"**: pick a plan, copy the link, send it. The client's id is attached, so the right account is credited whatever email they type.
- **Client pays the subscription** -> billing status becomes `active`, you get an alert email.
- **Client pays a minute pack** (admin link or dashboard "Buy 200 / 500 minutes") -> minutes are added automatically; a repeat delivery can never credit twice.
- **A monthly renewal fails** -> billing is marked `past_due` and you are emailed. Whop retries by itself.
- **Refund or dispute** -> you are emailed only. Nothing is paused automatically; decide in /admin.
- **/admin > Recent payments** lists the last 10 Whop events and which client each matched.
- If a payment matches no client, no minutes are credited; the alert tells you, and you add them by hand.

Cancellations are not auto-detected yet: you will see them in Whop. They can be added once you have seen a real cancellation payload.
