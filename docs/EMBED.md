# Website AI Receptionist — Embed Guide

The Website AI Receptionist is installed on a client's site with a single
copy-paste script tag. No framework, no API keys, no code changes on the
client side — the script injects a floating chat button and a chat panel
(an iframe) into the page.

## Install

Add this to the client site, ideally just before `</body>` (or anywhere in
the `<head>` — `defer` handles the rest):

```html
<script
  src="https://<platform-origin>/widget.js"
  data-business-id="ai-x-systems"
  defer
></script>
```

Where:

- `<platform-origin>` is the origin serving the platform (e.g. the team's
  preview URL or `https://aixsystems.com` once live). The script resolves
  its own origin from the `src` attribute, so the exact host doesn't need
  to match the client's site — the same snippet works from any deployment
  with no extra configuration.
- `data-business-id` is the tenant's business id (e.g. `ai-x-systems`).
  It is **required** — without it the widget logs a warning and does not
  load.

Example for Client #1 (AI X Systems' own site):

```html
<script
  src="https://aixsystems.com/widget.js"
  data-business-id="ai-x-systems"
  defer
></script>
```

## What the widget does

1. Locates its own `<script>` tag and reads `data-business-id`.
2. Derives the platform origin from the script's `src` (falls back to
   `window.location.origin` only if the src can't be parsed, e.g. the
   script is served same-origin without a URL).
3. Injects a floating chat button (bottom-right, indigo→sky gradient) and a
   hidden panel containing an iframe pointed at
   `<origin>/embed/chat/<businessId>`.
4. Clicking the button toggles the panel; `Escape` or the panel's ✕ closes
   it. On mobile the panel fills the viewport width minus a small margin.

The panel is a normal `<iframe>` of `/embed/chat/[businessId]`, which is
the chat UI itself — it renders inside the frame and talks to the Chat API
(`/api/chat/[businessId]`) from the platform origin.

## Data attributes

| Attribute          | Required | Description                                              |
| ------------------ | -------- | -------------------------------------------------------- |
| `data-business-id` | yes      | Tenant id as it appears in `data/businesses/<id>.json`.  |

## Behavior & safety

- **No global pollution** — everything runs inside an IIFE; the only
  global created is `window.AIXWidget` (`{ version, businessId, origin,
  open(), close(), toggle() }`).
- **Double-injection safe** — if `window.AIXWidget` already exists, the
  second load logs a warning and does nothing.
- **Missing config** — a missing `data-business-id` logs a clear warning
  and no-ops; it never throws.
- **CSS-isolated** — all injected styles use `aixw-` prefixed classes and
  `!important` on layout-critical properties, so host-page styles can't
  break the widget and the widget can't leak into the host page.
- **CORS** — the Chat API responds with per-business CORS headers; the
  iframe never makes cross-origin calls itself (it is same-origin with the
  platform), so no client-side CORS setup is needed.

## Local testing

Serve the platform (e.g. `next start` on port 3100) and open a throwaway
HTML page that references the script, e.g.:

```html
<!doctype html>
<html>
  <body>
    <h1>Test page</h1>
    <script src="http://localhost:3100/widget.js" data-business-id="ai-x-systems" defer></script>
  </body>
</html>
```

The button should appear bottom-right; clicking it should open the panel
with the chat UI ("Hi! How can I help you today?"). Chat replies require a
`GROQ_API_KEY` in the server environment — without it the API returns a
`llm_unavailable` error, which is expected during local testing and is not
a widget failure.

## Notes

- Chat answers are powered by the LLM configured on the server
  (`GROQ_API_KEY`); the widget itself contains no credentials.
- This file is part of the platform repo's `docs/` directory. Related
  contracts: `docs/CHAT-API.md` (request/response contract for the API the
  embed iframe calls).
