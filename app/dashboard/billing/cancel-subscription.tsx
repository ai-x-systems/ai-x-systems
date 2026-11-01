'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const REASONS = ['Too expensive', "Didn't get enough leads", 'Switching to another tool', 'Closing or pausing my business', 'Other']

/** Client: stop renewals (access continues to the end of the paid month) or undo a scheduled stop. */
export function CancelSubscription({ scheduled, endsOn }: { scheduled: boolean; endsOn?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState(REASONS[0])
  const [detail, setDetail] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function send(action: 'cancel' | 'resume') {
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/client/billing/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, reason: `${reason}${detail ? `: ${detail}` : ''}` }) })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (res.ok) { setMsg({ ok: true, text: action === 'cancel' ? 'Your subscription will not renew.' : 'Your subscription will continue.' }); setOpen(false); router.refresh() }
      else setMsg({ ok: res.status === 202, text: data.error || 'Something went wrong. Please contact us.' })
    } finally { setBusy(false) }
  }

  if (scheduled) {
    return (
      <div>
        <p className="text-sm">Your subscription is set to end{endsOn ? ` on ${endsOn}` : ' at the end of this billing period'}. Until then everything keeps working.</p>
        <button type="button" disabled={busy} onClick={() => send('resume')} className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">{busy ? 'Working…' : 'Keep my subscription'}</button>
        {msg ? <p className={`mt-2 text-xs ${msg.ok ? 'text-primary' : 'text-destructive'}`}>{msg.text}</p> : null}
      </div>
    )
  }
  return (
    <div>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="text-sm text-destructive underline underline-offset-4">Cancel my subscription</button>
      ) : (
        <div className="max-w-md rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p>You will not be charged again. You keep access until the end of the month you have already paid for. Unused phone minutes are not refunded.</p>
          <label className="mt-3 block text-xs text-muted-foreground">Why are you leaving? (optional, it helps us improve)
            <select className="mt-1 w-full rounded-md border border-input bg-input/30 px-2 py-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <input className="mt-2 w-full rounded-md border border-input bg-input/30 px-2 py-2 text-sm" value={detail} maxLength={300} onChange={(e) => setDetail(e.target.value)} placeholder="Anything else? (optional)" />
          <div className="mt-3 flex items-center gap-3">
            <button type="button" disabled={busy} onClick={() => send('cancel')} className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">{busy ? 'Cancelling…' : 'Yes, cancel at the end of the period'}</button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground underline underline-offset-4">Never mind</button>
          </div>
        </div>
      )}
      {msg ? <p className={`mt-2 text-xs ${msg.ok ? 'text-primary' : 'text-destructive'}`}>{msg.text}</p> : null}
    </div>
  )
}
