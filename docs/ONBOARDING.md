# Onboarding a client (no GitHub, no JSON)

## The flow
1. **Prospect replies** -> Admin -> Onboard -> **Create preview** (paste their website) -> send them the private link. For a phone demo press "Point the demo line at this preview".
2. **They say yes** -> send your payment request. In Onboard -> **Send setup link**, enter name, the email they pay from, what they bought and their website.
3. **They finish the form** (pre-filled, ~5 min): hours, services, answers, a password. They receive the install line and login; you get an email.
4. **You mark them paid** in /admin (Billing -> active). Voice clients: attach a number in /admin/voice and add minutes.
5. Leads arrive in their dashboard (name, email, phone, CSV), by email, and optionally in a CRM via webhook.

"Set up myself" (the full form) still exists for clients who send you everything by message.

## Install by platform
| Platform | Where the one line goes |
|---|---|
| WordPress | Plugin such as "WPCode" / "Insert Headers and Footers" → footer |
| Shopify | Online Store → Themes → Edit code → `theme.liquid`, before `</body>` |
| Webflow | Project settings → Custom code → Footer (paid site plan) |
| Wix | Settings → Custom code (needs a Premium plan) |
| Squarespace | Settings → Advanced → Code injection (Business plan or higher) |
| Custom / anything else | Before `</body>` |
| No site access | Share `https://<domain>/embed/chat/<id>` on social bios / Google Business Profile |

## Where leads go (all optional except the dashboard + email)
- Client dashboard + CSV download (always on)
- Alert email to the address you set
- CRM / automation: paste any Zapier, Make, n8n or CRM inbound-webhook URL at onboarding — every lead is POSTed as JSON
- Google Sheet (optional; needs the sheet shared with your service account)

## Pausing
/admin → the Billing column: set the status by hand, or **Pause assistant** (visitors see a polite offline message). Payment problems never pause anyone automatically.

## Billing
See `docs/EMAIL-AND-BILLING.md`. Freemius is not allowed for services; billing is manual for now (payment request, then mark paid and add minutes in /admin).

## Voice
See `docs/VOICE.md`: attach a phone number in /admin/voice, add minutes, done — the assistant is built from the same stored config.

## Not built yet
- Automatic pause on non-payment (deliberately manual for now).
- Editing services/hours after onboarding from the UI (FAQs + alert email are editable today; anything else is a database edit).
