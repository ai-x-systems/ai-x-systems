# Email, outreach and billing — current decisions

## Email
- **Brevo (free, 300/day) sends all transactional email**: lead alerts to clients, demo-request alerts to you, auto-replies, password resets. Set `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` (already in your Vercel). The sender address must be **verified in Brevo** (Senders, domains & dedicated IPs). If a lead alert never arrives, check Vercel logs for `[notify] Brevo rejected email`: a 400 usually means an unverified sender.
- Until your domain is authenticated in Brevo, Brevo may rewrite the From address to its own domain. That is fine for alerts a client expects.
- If Brevo fails or is not configured, the code falls back to Gmail SMTP.

## Outreach (finding clients)
- **Do not send cold email through Brevo.** Its policy requires provable opt-in for every contact, and it suspends accounts that break that (a second suspension can be permanent). A suspension would also stop your clients' lead alerts, because they use the same account.
- **Do not automate cold email from your Gmail.** That is the Google account behind your Vercel, Vapi and Supabase logins.
- **Manual mode (default)**: the system finds leads, finds emails and writes each message. You press Copy, paste it into your own mailbox, send it to that one person, press "I sent it". Follow-ups are written for you on day 3 and day 7. Keep it to a handful a day. Replies: press Replied. "No": press Never contact.
- Automatic sending is for later: it needs your own domain and a sender that explicitly allows cold email. Check that provider's policy first.

## Billing
- Freemius: not allowed for services (its signup says so). Do not use it.
- Lemon Squeezy: you noted payouts are not supported for you. Do not use it.
- **Now: manual.** Send a Payoneer payment request (or payment link), then in /admin set Billing to active and add minutes. Send the install message only after the setup fee clears.
- **Later: Paddle**, after you own a domain and have a live site with Terms and Privacy pages (Paddle reviews the website before approving).
  - Paddle's help center says it pays by wire transfer or Payoneer, monthly. Confirm your country in their supported-countries list when you apply.
  - Its acceptable-use list excludes human services not tied to software and also lists "phone services". Your product is software (widget, dashboard, minutes), but the voice receptionist may draw questions, and AI products get extra review. Describe it honestly as software with onboarding included, and ask Paddle in writing before relying on it.
  - Custom per-client prices are possible through their API (non-catalog prices). That integration is not built; do it only after Paddle approves you.
