# The automated flow, and what is still yours

## The loop

1. **Find (automatic, daily).** Google Places finds local businesses with a website. The system reads each site, finds a public email, and scores the lead.
2. **Preview (automatic).** For each lead whose website states opening hours plus a service or FAQ, the system builds a private preview assistant for that business (prices removed, no alerts, no billing). Leads where a faithful preview isn't possible get the plain email instead.
3. **Draft (automatic).** The email leads with the preview link: "I built this for you from your public website, try it." Follow-ups are written for day 3 and day 7.
4. **Send (you, 5 min/day, manual mode).** Copy each email into your own mailbox, send it, press "I sent it".
5. **Signal (automatic).** When a prospect opens their preview and chats, you get an email ("Someone is trying the preview for X"). If they leave details, you get those too. Follow up while it's fresh.
6. **Phone demo (you, 1 click).** If they want voice: Growth dashboard -> "Use demo line" -> tell them to call the shared number. Calls are free to them and capped at 2 minutes.
7. **Close and collect (you).** They say yes. Send a payment request (Payoneer for now).
8. **Setup (the client).** Admin -> Onboard -> "Send setup link" (enter name, their payment email, what they bought, their website). They open the link, check the pre-filled hours/services/answers, choose a password, finish. They get the install line and login by email; you get an alert.
9. **Mark paid (you, 10 seconds).** Billing -> active. Voice clients: attach a number in /admin/voice and add minutes.
10. **Serve (automatic).** Chat and phone are answered 24/7, leads reach the client (dashboard, email, CRM webhook), minutes are debited, low-balance emails go out, empty balance forwards to the client's human number.

Previews are deleted after 30 days unless the prospect replied, booked or bought.

## What still needs a person, and why
- Sending cold email (until you own a domain and a sender that allows cold email).
- Replying to prospects. Their questions decide the sale.
- Payment (until a processor that accepts your business is approved).
- Attaching a phone number for voice clients (the free Vapi number is shared; each client line is a paid number).
- Pointing the single demo line at whoever is about to call.

## Go-live checklist (in order)

### Database and deploy
- [ ] Run the new part of `supabase/schema.sql` (or the whole file; it is safe to re-run). It adds `client_intakes`, `businesses.services`, `outreach_leads.demo_business_id`, `voice_lines.is_demo_line`.
- [ ] Push the round-5 files, wait for the Vercel build to go green.

### Settings (Vercel)
- [ ] Present already: `SESSION_SECRET`, `SUPABASE_*`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `NEXT_PUBLIC_SITE_URL`, `VOICE_WEBHOOK_SECRET`, `UPSTASH_*`.
- [ ] `FOUNDER_NOTIFY_EMAIL` (you need this: preview signals and intake alerts go there).
- [ ] `BREVO_API_KEY` (an API key starting `xkeysib-`), `BREVO_SENDER_EMAIL` (verified in Brevo), `BREVO_SENDER_NAME`.
- [ ] `GOOGLE_PLACES_API_KEY` and `CRON_SECRET` (for the daily find/preview/draft run).
- [ ] `GROWTH_PHYSICAL_ADDRESS` before sending any cold email.
- [ ] Delete `ADMIN_BOOTSTRAP_SECRET` once you can log in.

### Test each piece once (30 minutes)
- [ ] /admin -> Onboard -> Create preview with a real local business's site. Open the link. Ask about hours and services; check the answers match their site and no prices appear.
- [ ] Leave your own name and email in the preview chat. You receive "Someone is trying the preview" and "Preview lead" emails.
- [ ] Open /try/<a real client id>. It must show 404.
- [ ] Onboard -> Send setup link to a second email address you own. Open the link in a private window, finish the form. Log in at /client/login. Check the dashboard shows only what you chose (chat-only hides minutes).
- [ ] Open the used link again: it says expired.
- [ ] Voice: create the demo line (/admin/voice -> Shared demo line, with your Vapi number, Server URL `.../api/voice/vapi?k=<VOICE_WEBHOOK_SECRET>`). Point it at a preview, call it, hang up, check the call appears.
- [ ] Growth: add one industry and one city, "Run full cycle", check a lead gets a preview link and an email draft that contains it.
- [ ] Read three drafted emails out loud. If you wouldn't send one to a stranger, don't.

### Your first 30 days
- Week 1: do the tests above. Send 5 emails a day by hand. Reply to every response the same day.
- Weeks 2-4: send the day-3 and day-7 follow-ups, open every preview signal, offer a short free pilot to anyone who tried the preview.
- First paying client: collect the setup fee, send the setup link, then buy the domain and apply to a payment processor.
