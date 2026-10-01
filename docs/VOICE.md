# Voice receptionist (Vapi) — clients prepay their own minutes

## How it works
- **Nothing is created in Vapi per client except a phone number.** When a call comes in, Vapi asks your server (`/api/voice/vapi`) who should answer. The server looks the dialed number up, builds the assistant from that client's stored config (same prompt, tools and knowledge as their website chat) and answers. Edit a client in /admin and the next call uses it.
- **Minutes are the currency.** 1 credit = 1 voice minute. Clients buy packs (Freemius checkout or a manual link), you add minutes, every finished call debits `ceil(seconds/60)` (calls under 5 seconds are free).
- **A call can never outlast the balance**: the max call length is capped to the minutes left. At 0 minutes the caller is forwarded to the client's fallback number (or hears a polite message) — a client never loses a call because of billing.
- **Low balance**: the client and you get an email when they drop below 15 minutes (`VOICE_LOW_BALANCE_MINUTES`).
- **Demo businesses are never charged** and calls are capped at 2 minutes — use one as your free sales demo line.

## What it costs you (verify on vapi.ai/pricing — this changes)
- Vapi hosting: **$0.05/min**, pay-as-you-go, prepaid; new accounts get free trial credits ($5–$10 depending on the source) and one free US number.
- On top, billed at cost: speech-to-text, the AI model, the voice, and telephony. Published real-world all-in figures range from about **$0.10 to $0.35 per minute**; a lean stack is ~$0.12–0.20.
- Free Vapi numbers are **US-only** and inbound-only. One free number per account on the current pricing page (older docs say up to 10) — so each additional client line usually means importing a paid Twilio/Telnyx number (roughly $1–2/month). Put that in the client's monthly fee.
- Concurrency: the pricing page lists 4 concurrent calls on the free tier (older material says 10). Check your dashboard.
- **Set your price from your real numbers**: make 5 test calls, open /admin/voice, compare "Vapi cost to you" with what you charge. Selling at 2–3× your measured cost is a normal starting point.

## Setup (one time)
1. Vapi account → add a payment method only when the free credits run low.
2. Vercel env (see `.env.example`): `VOICE_WEBHOOK_SECRET` (openssl rand -hex 32), `FOUNDER_NOTIFY_EMAIL`, optionally `VOICE_TOPUP_URL`, `FREEMIUS_MINUTE_PACKS`.
3. Re-run `supabase/schema.sql` (adds `voice_lines`, `voice_calls`).
4. Vapi → Phone Numbers → create the free US number → **leave Assistant empty** → Server URL: `https://<domain>/api/voice/vapi?k=<VOICE_WEBHOOK_SECRET>`.
5. /admin/voice → attach that number to a client (business id, number, optional human fallback number, what you charge per minute).
6. Give the client minutes: /admin → Minutes column → top up. (Or set `FREEMIUS_MINUTE_PACKS` and they buy packs themselves.)

## Test before any client (10 minutes)
- [ ] Call the number from your own phone with minutes > 0 → the assistant answers with the client's name.
- [ ] Give a name + email → a lead appears in the client dashboard (phone number filled in automatically from caller ID).
- [ ] Hang up → /admin/voice shows the call, length, billed minutes, Vapi cost; balance drops.
- [ ] If "Length" is 0 s for a real call, the end-of-call payload uses a field name this code doesn't read yet: check Vercel logs for `[voice] end-of-call report had no readable duration` and adjust `extractDurationSeconds` in `lib/voice/pure.ts`. Do this before charging anyone.
- [ ] Set balance to 0 → call again → forwarded to the fallback number (or the polite message).
- [ ] Pause the client in /admin → same result.

## Buying minutes with Freemius
Create a plan/pricing per pack (e.g. 100 minutes), then set `FREEMIUS_MINUTE_PACKS={"<plan or pricing id>":100}` and `VOICE_TOPUP_URL=<that pack's checkout link>`. A `payment.created` whose payload contains a configured id credits the minutes automatically (once per event). Not verified against a real payload — if a pack payment doesn't credit, the alert email says so and you add the minutes by hand.

## Be careful with
- **Healthcare and legal clients.** Phone calls there involve sensitive personal information; HIPAA-grade voice is a separate, expensive Vapi add-on (third-party sources cite ~$2,000/month — check). Start with home services, salons, trades, real estate, gyms.
- **Recording** is switched off by default (transcripts still exist). Turn it on only with a consent notice that fits the caller's location.
- **AI disclosure**: the greeting says "virtual assistant"; some places require telling callers they're talking to AI.
- The shared website-chat fallback through OpenRouter's free router is **not** used for calls.
