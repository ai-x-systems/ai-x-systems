# Onboarding a client (no GitHub, no JSON)

## The flow
1. **Demo → yes.** They agree.
2. **/admin → "+ Onboard client".** Type the business name, or paste their website and press *Draft from website*. Review every price, hour and policy (the assistant quotes them to customers), add the lead-alert email, press *Create client*.
3. You get, on one screen: the **install line**, the **client login**, your **payment link** (optional), and a **ready-to-send message**.
4. Client pastes one line into their site (any stack) or shares the hosted chat link. They pay with the same email as their login.
5. After the payment clears you mark them **active** in /admin and add minutes. Leads appear in their dashboard (name, email, phone, CSV download), by email, and optionally a Sheet or CRM webhook.

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
