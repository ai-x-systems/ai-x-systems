'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'

const STATUSES = ['awaiting_payment', 'active', 'past_due', 'cancelled', 'refunded']

/** Billing status and the on/off switch for one client's assistant. */
export function ClientStatusControls({ businessId, active, billingStatus, editable }: { businessId: string; active: boolean; billingStatus: string; editable: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  if (!editable) return <p className="text-xs text-muted-foreground">This client lives in your code files, so billing is managed there.</p>

  async function send(body: Record<string, unknown>, okText: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/clients/${businessId}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { toast('Could not save that change.', 'error'); return }
      toast(okText)
      router.refresh()
    } catch {
      toast('Could not reach the server.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs text-muted-foreground">
        Billing status
        <select
          className="mt-1 w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm"
          value={billingStatus}
          disabled={busy}
          onChange={(e) => send({ billingStatus: e.target.value }, `Billing set to ${e.target.value.replace('_', ' ')}`)}
        >
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() => send({ active: !active }, active ? 'Assistant paused' : 'Assistant is live again')}
        className={`btn btn-sm w-full ${active ? 'btn-outline' : 'btn-primary'}`}
      >
        {busy ? 'Saving…' : active ? 'Pause assistant' : 'Resume assistant'}
      </button>
    </div>
  )
}
