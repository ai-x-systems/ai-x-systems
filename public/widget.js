/*!
 * AI X Systems — Website AI Receptionist embed widget
 * ---------------------------------------------------------------------------
 * Copy-paste install (see docs/EMBED.md):
 *
 *   <script src="https://<your-origin>/widget.js" data-business-id="ai-x-systems" defer></script>
 *
 * The widget injects a floating chat button and a panel (an <iframe> pointing
 * at <origin>/embed/chat/<businessId>) into the host page. The origin is
 * derived from this script's own src, so the same snippet works from any
 * deployment (preview origin, production aixsystems.com, etc.) with zero
 * configuration. It falls back to window.location.origin only when the
 * script src cannot be parsed (e.g. served same-origin without a URL).
 *
 * Zero dependencies, no framework, no global clobbering: everything lives in
 * this IIFE and the only global created is window.AIXWidget (a tiny API:
 * open/close/toggle/version).
 *
 * Version: 1.0.0
 */
(function (global) {
  "use strict";

  var VERSION = "1.0.0";

  // -------------------------------------------------------------------------
  // 1. Find this script tag and read its configuration.
  // -------------------------------------------------------------------------
  var scripts = document.getElementsByTagName("script");
  var script = null;
  for (var i = scripts.length - 1; i >= 0; i--) {
    if ((scripts[i].src || "").indexOf("/widget.js") !== -1) {
      script = scripts[i];
      break;
    }
  }
  if (!script) return; // not loaded as a script with src — nothing to bind to

  var businessId = script.getAttribute("data-business-id");
  if (!businessId) {
    console.warn(
      "[AI X Systems widget] Missing data-business-id attribute on the widget.js script tag. " +
        'Add one, e.g. <script src="/widget.js" data-business-id="ai-x-systems" defer></script>. ' +
        "The widget was not loaded."
    );
    return;
  }

  // Guard against double-injection (e.g. a snippet pasted twice).
  if (global.AIXWidget) {
    console.warn(
      "[AI X Systems widget] Already initialized on this page (window.AIXWidget exists). Skipping duplicate load."
    );
    return;
  }

  // -------------------------------------------------------------------------
  // 2. Resolve the platform origin from this script's own src.
  // -------------------------------------------------------------------------
  var origin = null;
  try {
    origin = new URL(script.src).origin;
  } catch (e) {
    origin = null;
  }
  if (!origin || origin === "null") origin = global.location.origin;
  origin = origin.replace(/\/+$/, "");

  var iframeUrl = origin + "/embed/chat/" + encodeURIComponent(businessId);

  // -------------------------------------------------------------------------
  // 3. Brand constants (indigo -> sky, per the AI X Systems brand).
  // -------------------------------------------------------------------------
  var GRADIENT = "linear-gradient(135deg, #4f46e5 0%, #0ea5e9 100%)";
  var CHAT_ICON_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="none" ' +
    'stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' +
    "</svg>";
  var CLOSE_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" ' +
    'stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' +
    "</svg>";

  // -------------------------------------------------------------------------
  // 4. Scoped styles. Class names are prefixed (aixw-) so the host page's CSS
  //    cannot clash with ours, and we use !important on layout-critical
  //    properties so common resets/overrides cannot break positioning.
  // -------------------------------------------------------------------------
  var STYLE_ID = "aixw-styles";
  var CSS =
    ".aixw-launcher{" +
    "position:fixed;right:24px;bottom:24px;width:60px;height:60px;border-radius:50%;" +
    "background:" + GRADIENT + ";" +
    "box-shadow:0 8px 24px rgba(30,41,59,.35);border:0;cursor:pointer;z-index:2147483000;" +
    "display:flex;align-items:center;justify-content:center;" +
    "transition:transform .15s ease,box-shadow .15s ease;-webkit-tap-highlight-color:transparent;" +
    "} " +
    ".aixw-launcher:hover{transform:scale(1.06);box-shadow:0 10px 28px rgba(30,41,59,.45);} " +
    ".aixw-launcher:focus-visible{outline:3px solid rgba(79,70,229,.6);outline-offset:2px;} " +
    ".aixw-panel{" +
    "position:fixed;right:24px;bottom:24px;width:400px;height:min(680px,calc(100vh - 48px));" +
    "max-width:calc(100vw - 32px);z-index:2147483000;" +
    "background:#ffffff;border-radius:16px;overflow:hidden;" +
    "box-shadow:0 16px 48px rgba(15,23,42,.28);" +
    "display:flex;flex-direction:column;border:1px solid rgba(15,23,42,.08);" +
    "transform-origin:bottom right;transition:opacity .18s ease,transform .18s ease;" +
    "} " +
    // visibility:hidden removes the closed panel from the tab order and the
    // accessibility tree (the iframe must not be reachable while closed).
    ".aixw-panel.aixw-hidden{opacity:0;transform:scale(.92) translateY(12px);pointer-events:none;visibility:hidden;} " +
    ".aixw-header{" +
    "flex:0 0 auto;height:52px;background:" + GRADIENT + ";" +
    "display:flex;align-items:center;justify-content:space-between;padding:0 8px 0 18px;" +
    "color:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:600;" +
    "} " +
    ".aixw-close{" +
    "background:transparent;border:0;cursor:pointer;padding:10px;border-radius:8px;" +
    "display:flex;align-items:center;justify-content:center;color:#ffffff;opacity:.85;" +
    "} " +
    ".aixw-close:hover{opacity:1;background:rgba(255,255,255,.14);} " +
    ".aixw-frame{flex:1 1 auto;border:0;width:100%;height:100%;background:#ffffff;display:block;} " +
    "@media (max-width:480px){" +
    ".aixw-panel{right:12px;bottom:12px;width:calc(100vw - 24px);height:calc(100vh - 24px);max-width:none;border-radius:14px;}" +
    ".aixw-launcher{right:16px;bottom:16px;}" +
    "}";

  // -------------------------------------------------------------------------
  // 5. Build the DOM (deferred until the document is ready).
  // -------------------------------------------------------------------------
  var launcher = null;
  var panel = null;
  var open = false;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function setOpen(next) {
    open = next;
    panel.classList.toggle("aixw-hidden", !open);
    launcher.setAttribute("aria-expanded", open ? "true" : "false");
    launcher.title = open ? "Close chat" : "Chat with us";
    launcher.innerHTML = open ? CLOSE_SVG : CHAT_ICON_SVG;
  }

  function toggle() {
    setOpen(!open);
  }

  function build() {
    ensureStyles();

    launcher = document.createElement("button");
    launcher.type = "button";
    launcher.className = "aixw-launcher";
    launcher.title = "Chat with us";
    launcher.setAttribute("aria-label", "Open chat");
    launcher.setAttribute("aria-expanded", "false");
    launcher.innerHTML = CHAT_ICON_SVG;
    launcher.addEventListener("click", toggle);
    document.body.appendChild(launcher);

    panel = document.createElement("div");
    panel.className = "aixw-panel aixw-hidden";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Chat");

    var header = document.createElement("div");
    header.className = "aixw-header";
    header.textContent = "Chat with us";
    var close = document.createElement("button");
    close.type = "button";
    close.className = "aixw-close";
    close.setAttribute("aria-label", "Close chat");
    close.innerHTML = CLOSE_SVG;
    close.addEventListener("click", toggle);
    header.appendChild(close);
    panel.appendChild(header);

    var frame = document.createElement("iframe");
    frame.className = "aixw-frame";
    frame.src = iframeUrl;
    frame.title = "Chat with us";
    frame.setAttribute("loading", "eager");
    panel.appendChild(frame);

    document.body.appendChild(panel);

    // Escape closes the panel (but never steals focus from the iframe chat).
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && open) setOpen(false);
    });
  }

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  // -------------------------------------------------------------------------
  // 6. Initialize. Expose a small API as the single global.
  // -------------------------------------------------------------------------
  ready(function () {
    if (document.body) {
      build();
    } else {
      // Extremely defensive: body should exist by DOMContentLoaded, but if
      // something loaded the script even later, wait for it.
      var guard = setInterval(function () {
        if (document.body) {
          clearInterval(guard);
          build();
        }
      }, 50);
    }
  });

  global.AIXWidget = {
    version: VERSION,
    businessId: businessId,
    origin: origin,
    open: function () {
      if (panel) setOpen(true);
    },
    close: function () {
      if (panel) setOpen(false);
    },
    toggle: function () {
      if (panel) toggle();
    },
  };
})(window);
