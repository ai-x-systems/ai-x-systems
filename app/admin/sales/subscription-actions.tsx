'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'

/** Admin: end a client's subscription (at the end of the paid month, or right now) or undo a scheduled end. */
export function SubscriptionActions({ businessId, scheduled, canCancel }: { businessId: string; scheduled: boolean; canCancel: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function run(mode: 'period_end' | 'now' | 'resume') {
    const ask =
      mode === 'now' ? 'End this subscription immediately? They lose access to the paid period.'
      : mode === 'period_end' ? 'Stop renewals? They keep access until the end of the month they already paid for.'
      : 'Undo the scheduled cancellation?'
    if (!window.confirm(ask)) return
    setBusy(true); setMsg('')
    try {
      const res = await fetch('/api/admin/billing/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessId, mode }) })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setMsg(res.ok ? 'Done.' : data.error || 'Failed.')
      if (res.ok) { toast('Subscription updated'); router.refresh() } else toast(data.error || 'Failed.', 'error')
    } finally { setBusy(false) }
  }

  if (!canCancel && !scheduled) return <span className="text-xs text-muted-foreground">no subscription</span>
  return (
    <div className="flex flex-col gap-1">
      {scheduled ? (
        <button type="button" disabled={busy} onClick={() => run('resume')} className="text-left text-xs text-primary underline underline-offset-4">Undo scheduled end</button>
      ) : (
        <>
          <button type="button" disabled={busy} onClick={() => run('period_end')} className="text-left text-xs text-primary underline underline-offset-4">End at period end</button>
          <button type="button" disabled={busy} onClick={() => run('now')} className="text-left text-xs text-destructive underline underline-offset-4">End now</button>
        </>
      )}
      {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
    </div>
  )
}
