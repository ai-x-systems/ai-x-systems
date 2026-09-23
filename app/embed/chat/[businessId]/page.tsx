"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";

/**
 * app/embed/chat/[businessId]/page.tsx
 * ---------------------------------------------------------------------
 * Loaded inside widget.js's iframe. Deliberately header-less — the outer
 * widget panel (public/widget.js) already renders the branded gradient
 * header with the business name and the close button, so a second header
 * in here would duplicate it. Opening this URL directly (e.g. for QA)
 * will look header-less; that's an accepted trade-off for not showing
 * two stacked headers in the real embedded experience.
 *
 * Mobile-safe height: uses 100dvh (dynamic viewport height) with a 100vh
 * fallback via CSS cascade (the second declaration wins in browsers that
 * support dvh, is silently ignored in ones that don't). Plain 100vh
 * inside an iframe on mobile Safari/Chrome is taller than the visible
 * area once the address bar is showing, which pushes the input box below
 * the fold — this fixes that.
 * ---------------------------------------------------------------------
 */

interface Message {
  role: "user" | "assistant";
  content: string;
}

const GRADIENT = "linear-gradient(135deg, #4f46e5 0%, #0ea5e9 100%)";

/**
 * Turns any link in a message into a real clickable link, styled to
 * stand out against both bubble colors. The route already normalizes stray
 * Unicode dash characters in URLs (see lib/chat/chat-response.ts) before
 * this ever runs.
 *
 * Handles two shapes, in one pass, so they can never double-render:
 * Markdown-style [label](url) — the model is now instructed not to emit
 * these (see lib/prompt/prompt-builder.ts's FORMATTING rule), but this is
 * a safety net in case it does anyway — and bare "https://..." URLs.
 * A naive bare-URL-only regex would swallow an entire [text](url)
 * construct as one malformed match (no whitespace between the two halves),
 * which is what caused the "doubled" link text seen in testing.
 */
function linkify(text: string): ReactNode[] {
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|https?:\/\/\S+/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
    }

    const linkStyle = { color: "inherit", textDecoration: "underline", fontWeight: 600 } as const;

    if (match[1] && match[2]) {
      // Markdown-style [label](url)
      nodes.push(
        <a key={key++} href={match[2]} target="_blank" rel="noreferrer" style={linkStyle}>{match[1]}</a>
      );
    } else {
      // Bare URL — trailing punctuation (a period ending the sentence, a
      // closing paren) shouldn't be swallowed into the link itself.
      const raw = match[0];
      const trimmed = raw.replace(/[),.]+$/, "");
      const trailing = raw.slice(trimmed.length);
      nodes.push(<a key={key++} href={trimmed} target="_blank" rel="noreferrer" style={linkStyle}>{trimmed}</a>);
      if (trailing) nodes.push(<span key={key++}>{trailing}</span>);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }

  return nodes;
}

export default function EmbeddedChatPage() {
  const { businessId } = useParams<{ businessId: string }>();

  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! How can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  // Round-tripped to the server on every request once true — see
  // chat-request-schema.ts's leadAlreadyLogged for why this can't just
  // live server-side: each request is a fresh, stateless invocation.
  const [leadLogged, setLeadLogged] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: input }];
    setMessages(nextMessages);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setLoading(true);

    try {
      const res = await fetch(`/api/chat/${businessId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, leadAlreadyLogged: leadLogged }),
      });
      const data = await res.json();
      const replyContent = data.success ? data.reply : data.error.message;
      if (data.success && data.leadLogged) setLeadLogged(true);
      setMessages([...nextMessages, { role: "assistant", content: replyContent }]);
    } catch {
      setMessages([
        ...nextMessages,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        background: "#ffffff",
        overflow: "hidden",
      }}
      className="aixw-embed-root"
    >
      <style>{`
        .aixw-embed-root { height: 100vh; height: 100dvh; }
        .aixw-scroll::-webkit-scrollbar { width: 6px; }
        .aixw-scroll::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
        @keyframes aixw-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: .4; } 30% { transform: translateY(-4px); opacity: 1; } }
        .aixw-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #6b7280; margin: 0 2px; animation: aixw-bounce 1.2s infinite; }
        .aixw-dot:nth-child(2) { animation-delay: .15s; }
        .aixw-dot:nth-child(3) { animation-delay: .3s; }
        textarea.aixw-input::placeholder { color: #9ca3af; }
      `}</style>

      <div ref={scrollRef} className="aixw-scroll" style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", marginBottom: 12, justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            {m.role === "assistant" && (
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: GRADIENT, flexShrink: 0, marginRight: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>
                AI
              </div>
            )}
            <div
              style={{
                display: "inline-block",
                padding: "10px 14px",
                borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                background: m.role === "user" ? GRADIENT : "#f3f4f6",
                color: m.role === "user" ? "#fff" : "#111827",
                maxWidth: "78%",
                fontSize: 14,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {linkify(m.content)}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: GRADIENT, flexShrink: 0, marginRight: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>
              AI
            </div>
            <div style={{ padding: "10px 14px", borderRadius: "14px 14px 14px 4px", background: "#f3f4f6" }}>
              <span className="aixw-dot" />
              <span className="aixw-dot" />
              <span className="aixw-dot" />
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          borderTop: "1px solid #e5e7eb",
          padding: "10px 12px",
          paddingBottom: "calc(10px + env(safe-area-inset-bottom))",
          background: "#ffffff",
        }}
      >
        <textarea
          ref={inputRef}
          className="aixw-input"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            // Auto-grow up to maxHeight, then let it scroll internally.
            // Previously fixed at rows={1} with an unused maxHeight — a
            // longer message just scrolled inside one tiny line instead
            // of the box actually growing.
            const el = e.target;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Type a message…"
          rows={1}
          style={{
            flex: 1,
            resize: "none",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: "9px 12px",
            // 16px, not 14px: iOS Safari auto-zooms the entire page when
            // a focused input/textarea has a font-size under 16px — a
            // hard platform behavior, not a style choice. Below 16px
            // here meant tapping the chat input on iPhone visibly
            // zoomed the whole page in.
            fontSize: 16,
            fontFamily: "inherit",
            maxHeight: 96,
            outline: "none",
            color: "#111827",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{
            flexShrink: 0,
            background: loading || !input.trim() ? "#d1d5db" : undefined,
            backgroundImage: loading || !input.trim() ? "none" : GRADIENT,
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "9px 16px",
            fontSize: 14,
            fontWeight: 600,
            cursor: loading || !input.trim() ? "default" : "pointer",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
