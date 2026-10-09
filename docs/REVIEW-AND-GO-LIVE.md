# AI x Systems — full review, fixes, and go-live checklist

Reviewed: the whole repo (auth, sessions, chat API, LLM layer, tools, email, Sheets/Calendar, widget, admin/client dashboards, prospects pipeline, docs).
Verified here: `tsc --noEmit` clean, 20+ unit assertions on the growth logic pass (`npm run test:growth`).
NOT verified here: a full `next build` (the sandbox blocks Google Fonts) and anything against your live Supabase / Resend / Google accounts. Test those on a Vercel preview first.

## 1. What was wrong (found in review) and what changed

### Critical
| # | Problem | Fix |
|---|---|---|
| 1 | **Public client sign-up let anyone create a login for ANY business** (`/api/auth/signup` + `/client/signup`) and read that business's leads, caller names and credit history. The signup page even suggested `ai-x-systems` as the ID. | Route now returns 403; both signup pages replaced with an "invitation only" notice; nav/login links removed. Admins still create logins from `/admin`. |
| 2 | **Fire-and-forget email/webhook/activity (`void sendOwnerAlert(...)`) on serverless.** Vercel can freeze the function the instant the response returns, killing an in-flight SMTP handshake. This is the likely real cause of your "isolated Gmail timeout" — not Gmail itself. | New `runInBackground()` (uses Next's `after()`) keeps the function alive until the work finishes. Chat route `maxDuration = 30`. |
| 3 | **Sessions never expired and survived password resets.** Cookie was just `accountId.hmac`. | Token now carries an expiry and a fingerprint of the current password hash: stolen cookies expire; any password change kills all sessions. (Everyone logs in once again after deploy.) |

### High / medium
| # | Problem | Fix |
|---|---|---|
| 4 | Email lookup used `ilike` — `%` and `_` in user input act as wildcards (login, reset, signup duplicate check). | Exact lowercase `eq` match. |
| 5 | LLM fallback only triggered on Groq **429**. Any 5xx / network error skipped OpenRouter and failed the visitor. | Falls back on any Groq failure. |
| 6 | Rate limits were in-memory per instance (each Vercel instance has its own counter) — effectively no limit under load. | Shared limiter (`lib/security/rate-limit.ts`): Upstash Redis when configured, memory fallback. Applied to chat (per visitor **and** a daily per-business ceiling so a script can't burn your Groq quota), login (per account+IP and per IP), password reset (stops email-bombing), bootstrap-admin, demo form. |
| 7 | `/demo` submissions notified **nobody** and the prospect got no reply. | Instant founder alert + instant honest auto-reply; honeypot field; field length caps. |
| 8 | Public contact email typo in `ai-x-systems.json`: `hellp@aixsystems.app` (the AI can quote it to visitors). | Fixed to `hello@`. |
| 9 | Admin bootstrap secret compared with `!==` (timing) and unthrottled. | Timing-safe compare + rate limit. **Delete `ADMIN_BOOTSTRAP_SECRET` once your admin exists.** |
| 10 | Gmail SMTP had no timeouts; no HTTP email path. | Resend HTTP API is now the preferred transport (Gmail stays as fallback); SMTP timeouts added. |
| 11 | `supabase/schema.sql` was referenced everywhere but **missing from the repo**; `docs/DASHBOARD.md` still described JSON-file stores; no `.env.example`. | Added `supabase/schema.sql` (reconstructed from the code — diff against your live tables before running), `.env.example`, refreshed docs. |
| 12 | `robots.txt` allowed crawling admin/client/API paths. | Disallowed. |

### Noted, not changed (your call)
- **OpenRouter's free router sends conversations to rotating third-party free models.** Fine for your own demo; for real clients (dental/medical/legal) it's a privacy problem. Before onboarding a client, either pay for Groq or restrict the fallback to demo businesses.
- `debug-sheet-access` and `debug-google-account` are admin-gated and safe, but remove them once integrations are stable.
- `lint` script points at ESLint, which isn't installed. Use `npm run typecheck`.
- Groq free tier remains the ceiling; the daily cap protects you but a real client needs a paid plan.
- `smile-dental-clinic.json` still has `leadSheetId: "REPLACE_WITH_SHEET_ID"` — fine while `demo: true`, breaks the moment it's flipped live.
- Client `businessId`s are guessable slugs; harmless now that sign-up is closed, but never treat them as secrets.

## 2. NEW: the Growth engine (`/admin/growth`)

Loop (runs weekdays via Vercel Cron, or press buttons):
1. **Discover** — Google Places finds `industry × city` businesses that have a website.
2. **Enrich** — reads the site (home + contact pages), extracts a public business email, notes whether they already have a chat widget / online booking, scores the lead (no widget + many reviews + phone = best).
3. **Draft** — the model writes ONE opening line from facts it's given; the rest is a fixed, honest 3-step template (day 0 / +3 / +4 days). The model cannot invent claims; a line that fails validation is replaced by a plain fallback.
4. **Approve** — default: every email waits in the queue for one click (edit allowed). Flip **Fully automatic sending** when you trust the output.
5. **Send** — via Resend only, with `List-Unsubscribe` one-click headers, your physical address, a signed unsubscribe link, suppression list, and **domain warm-up** (≈5 emails day one, +3/day, capped by your setting).
6. **Track** — bounces/complaints suppress automatically; replies stop the sequence (automatic with Resend inbound, otherwise one click on "Replied"). A `/demo` submission from a contacted address also stops the sequence and marks it "Demo booked".

The dashboard shows funnel, reply rate, approval queue, per-lead actions, and a **readiness panel** that refuses to send until compliance and deliverability basics are in place.

Honest limits:
- Cold email to strangers is legal in the US under CAN-SPAM if you identify yourself, include an address and honor opt-outs (built in). **EU/UK/Canada/others have stricter rules** — keep the target country at `US` unless you've checked.
- Sending from your main domain risks it. Use a subdomain (`mail.aixsystems.app`).
- Emails describe only what's live: default offer is the **website** AI receptionist. Don't switch to "voice" until the Vapi agent exists.
- Emails found on websites are sometimes wrong or generic; expect a modest reply rate. This automates finding and contacting — it doesn't guarantee clients.

## 3. Go-live checklist (do in this order)

### A. Today, no domain needed
- [ ] Run `supabase/schema.sql` in Supabase → SQL Editor (compare with existing tables first).
- [ ] Vercel env: `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `OPENROUTER_API_KEY` (see `.env.example`).
- [ ] Create Upstash Redis (free) → add `UPSTASH_REDIS_REST_URL/TOKEN`.
- [ ] Set `FOUNDER_NOTIFY_EMAIL` (where demo-request alerts go).
- [ ] Deploy to a **preview** first. Log in as admin (you'll be logged out once — expected).
- [ ] Confirm `/client/signup` shows the invitation notice and `POST /api/auth/signup` returns 403.
- [ ] Submit `/demo` yourself → you get the alert, the auto-reply arrives, the row shows in `/admin/inquiries`.
- [ ] Test chat end to end on `ai-x-systems`: lead lands in the Sheet, owner email arrives (now reliable), dashboard activity shows it.
- [ ] Retest `smile-dental-clinic` in demo mode (it was never retested).
- [ ] Delete `ADMIN_BOOTSTRAP_SECRET` from Vercel.

### B. Domain + email (unlocks outreach) — the critical path
- [ ] Buy `aixsystems.app`, attach to Vercel, update `lib/site-config.ts`.
- [ ] Email forwarding for `hello@` → your inbox (Cloudflare Email Routing or similar), so your personal Gmail never appears publicly.
- [ ] Resend: verify `aixsystems.app` (transactional) and `mail.aixsystems.app` (outreach). Set `RESEND_API_KEY`, `RESEND_FROM`, `GROWTH_FROM`, `GROWTH_REPLY_TO=hello@aixsystems.app`.
- [ ] `GROWTH_PHYSICAL_ADDRESS` (PO box / virtual mailbox is fine).
- [ ] Resend → Webhooks → `https://aixsystems.app/api/growth/webhook`, events `email.bounced`, `email.complained`, `email.received`; set `RESEND_WEBHOOK_SECRET`. Enable inbound on the domain if you want automatic reply detection.
- [ ] Google Cloud: enable **Places API (New)**, create key, restrict it to that API, set `GOOGLE_PLACES_API_KEY`. Set a billing budget alert.
- [ ] Vercel env `CRON_SECRET` (any long random string). `vercel.json` already schedules the run.

### C. Turn on outreach
- [ ] `/admin/growth` → readiness panel is all green.
- [ ] Settings: 1–2 industries, 1–2 cities, your first name, cap 30, country US, offer = website.
- [ ] Press **Run full cycle**, then review the first 5–10 drafts by hand.
- [ ] Approve a few; send yourself a test by adding your own address as a lead first.
- [ ] After ~2 weeks with good bounce/complaint numbers, consider Fully automatic sending.

### D. Before the first paying client
- [ ] Decide the LLM fallback policy for client conversations (see "Noted").
- [ ] Onboard them: JSON file, Sheet + Calendar shared with the service account, `/admin` create login, install snippet.
- [ ] Payment Request Link sent; record it in `/admin`.

## 4. NEW (round 2): self-serve onboarding + Freemius billing

See `docs/ONBOARDING.md`. Summary:
- **/admin/onboard**: create a client without Git. Config saved in the `businesses` table (DB wins over `data/businesses/*.json`, so your two existing businesses are untouched). Optional *Draft from website* fills the form from the client's site for you to review.
- Returns the install line, login, checkout link and a copy-paste welcome message.
- **Client dashboard** now shows each lead's email and phone (previously only name + reason), a CSV download, and the install line — so Google Sheets is optional.
- **Freemius webhook** (`/api/billing/freemius`): signature-verified, idempotent, matches the buyer's email to the client, sets billing status, emails you on payments, cancellations, failed renewals, refunds and disputes. It never pauses a client by itself.
- **Pause/Resume** per client in /admin.
- Verified: `tsc` clean, `npm test` (growth + onboarding + billing, 40+ assertions), and a full `next build --webpack` succeeded here with Google Fonts mocked. Not verified: anything against live Supabase/Freemius/Resend.

### Go-live additions
- [ ] Re-run `supabase/schema.sql` (adds `billing_events` and three columns on `businesses`).
- [ ] Freemius: product, plan, webhook, `FREEMIUS_PRODUCT_SECRET_KEY`, `FREEMIUS_CHECKOUT_URL` (see docs/ONBOARDING.md).
- [ ] Confirm in Freemius's vendor terms that a managed AI-receptionist subscription is an allowed product and that your country/payout method is supported.
- [ ] Onboard a test client, install the snippet on a scratch page, chat, confirm the lead shows in the dashboard with email/phone, download the CSV.
- [ ] Make a Freemius test purchase and confirm the billing status flips to active.

## 5. NEW (round 3): voice receptionist with prepaid minutes

See `docs/VOICE.md`. Summary:
- `/api/voice/vapi` is the only voice endpoint. Vapi asks it who answers each call; it builds the assistant from the client's stored config (no per-client assistant in Vapi), runs the same booking/lead code as the chat, and debits minutes when the call ends.
- **Clients prepay minutes** (1 credit = 1 minute). The dashboard shows minutes left, their AI phone number, recent calls and a buy link. Calls are capped to the remaining balance, and at zero the caller is forwarded to a human fallback, never dropped.
- `/admin/voice`: attach a phone number to a client, see every call, billed minutes and your Vapi cost per call (margin).
- Minute packs can auto-credit from Freemius payments (`FREEMIUS_MINUTE_PACKS`), once per event.
- Demo businesses are free and capped at 2 minutes per call — a zero-cost sales demo line.
- Verified: `tsc` clean, `npm test` (growth, onboarding, billing, voice — 100+ assertions) and a full `next build`. Vapi's webhook formats were checked against their current docs, but **no real call was made** — run the 10-minute test in docs/VOICE.md before charging anyone.

### Go-live additions
- [ ] Re-run `supabase/schema.sql` (adds `voice_lines`, `voice_calls`).
- [ ] Env: `VOICE_WEBHOOK_SECRET` (+ optional `VOICE_TOPUP_URL`, `FREEMIUS_MINUTE_PACKS`).
- [ ] Vapi: free number, Server URL `…/api/voice/vapi?k=…`, Assistant left empty.
- [ ] Run the test checklist in docs/VOICE.md, especially "Length is not 0 s".
- [ ] Avoid healthcare/legal voice clients until you have a compliant plan.

## 6. Round 4: Brevo email, manual outreach, billing decisions

See `docs/EMAIL-AND-BILLING.md`.
- **Brevo** is now the preferred transactional sender (alerts, auto-replies, resets). Your existing `BREVO_*` Vercel variables are used. Verify the sender in Brevo first.
- **Outreach is manual by default**: the system finds and drafts, you copy and send from your own mailbox, press "I sent it". Cold email through Brevo would break its policy and risk the account that delivers client alerts. Section 2's Resend description is superseded: automatic sending is a later step.
- **Billing**: Freemius and Lemon Squeezy are out. Manual now; Paddle after you own a domain and have a reviewed website (check its "phone services" and AI-product rules first).
- No domain needed until your first client validates the product. Vercel Hobby is fine for testing, but its terms cover non-commercial use, so move to Pro before you rely on it for paying clients.

## 7. Round 5: auto-demo and self-serve intake

See `docs/AUTOMATION-FLOW.md` (flow + checklist).
- **Previews**: the daily run builds a private preview business from each lead's own website (only when it states hours plus a service or FAQ; prices removed; no alerts or billing). Cold emails lead with the link. You are alerted when a prospect chats or leaves details. Previews expire after 30 days unless the prospect engaged. The preview page only ever shows generated previews, never a real client.
- **Phone demo**: one shared demo line, pointed at a preview with one click, free to the prospect and capped at 2 minutes.
- **Intake link**: after a prospect says yes you send a private, expiring, one-time link. The client reviews the pre-filled setup, chooses a password and finishes; the system creates the business and login and emails the install line. Their login email is fixed by you, so it matches their payment email.
- **Services**: each client is chat, voice or both; the dashboard shows only what applies.
- Verified: `tsc`, 5 test suites, a full `next build`, and runtime checks of the new routes (404 for non-previews, 410 for used or unknown links, 403 for admin routes without login). Not verified against live Supabase, Brevo or Vapi.

## 8. Still open (roadmap)
1. Edit services, hours and booking from the UI after onboarding.
2. Paddle integration (after approval) so payment triggers setup and minutes by itself.
3. Automatic outreach sending (after the domain and a cold-email-friendly sender).
4. Per-client usage analytics.
