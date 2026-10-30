"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "connecting" | "live" | "error";

type VapiLike = {
  start: (assistant: never) => Promise<unknown>;
  stop: () => void;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
};

/**
 * Browser voice demo for a preview page. Fetches the business's real assistant from
 * /api/voice/web-assistant/<id> and starts a Vapi web call, so no phone number is involved.
 * Needs NEXT_PUBLIC_VAPI_PUBLIC_KEY (Vapi dashboard > API Keys > Public Key).
 */
export default function TalkToAva({
  businessId,
  assistantName,
  from,
  to,
}: {
  businessId: string;
  assistantName: string;
  from: string;
  to: string;
}) {
  const vapiRef = useRef<VapiLike | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => () => vapiRef.current?.stop(), []);

  async function start() {
    const key = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
    if (!key) {
      setMessage("The voice demo is not switched on yet.");
      setStatus("error");
      return;
    }
    setMessage("");
    setStatus("connecting");
    try {
      const res = await fetch(`/api/voice/web-assistant/${encodeURIComponent(businessId)}`, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { assistant?: unknown; error?: string };
      if (!res.ok || !data.assistant) throw new Error(data.error || "The voice demo is not available right now.");

      const { default: Vapi } = await import("@vapi-ai/web");
      const vapi = new Vapi(key) as unknown as VapiLike;
      vapi.on("call-start", () => setStatus("live"));
      vapi.on("call-end", () => setStatus("idle"));
      vapi.on("error", (e) => {
        console.error("Vapi error", e);
        setMessage("The call stopped. Check that your browser allows the microphone, then try again.");
        setStatus("error");
      });
      vapiRef.current = vapi;
      await vapi.start(data.assistant as never);
    } catch (err) {
      console.error(err);
      setMessage(err instanceof Error ? err.message : "The call could not start.");
      setStatus("error");
    }
  }

  function stop() {
    vapiRef.current?.stop();
  }

  const live = status === "live";
  const busy = status === "connecting";

  return (
    <div>
      <button
        type="button"
        onClick={live ? stop : start}
        disabled={busy}
        className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-70"
        style={{ background: live ? "#b3261e" : `linear-gradient(135deg, ${from} 0%, ${to} 100%)`, color: "#ffffff" }}
      >
        {busy ? "Connecting…" : live ? "End call" : `Talk to ${assistantName}`}
      </button>
      <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
        {live
          ? `You're talking to ${assistantName}. The call stops after 2 minutes.`
          : "Free live demo in your browser. Allow the microphone when asked."}
      </p>
      {message && <p className="mt-1 text-xs text-red-500" role="alert">{message}</p>}
    </div>
  )
}
