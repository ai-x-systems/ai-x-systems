'use client'

import { useRouter } from 'next/navigation'

export function ClientStatusControls({ businessId, active, billingStatus, editable }: { businessId: string; active: boolean; billingStatus: string; editable: boolean }) {
  const router = useRouter()
  if (!editable) return <span className="text-xs text-muted-foreground">file-based</span>

  async function send(body: Record<string, unknown>) {
    await fetch(`/api/admin/clients/${businessId}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    router.refresh()
  }
  return (
    <div className="flex flex-col gap-1.5">
      <select className="rounded-md border border-input bg-input/30 px-2 py-1 text-xs" value={billingStatus} onChange={(e) => send({ billingStatus: e.target.value })}>
        {['awaiting_payment', 'active', 'past_due', 'cancelled', 'refunded'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
      </select>
      <button className="text-left text-xs text-primary underline underline-offset-4" onClick={() => send({ active: !active })}>
        {active ? 'Pause assistant' : 'Resume assistant'}
      </button>
    </div>
  )
}
