'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const WHAT = [
  { key: 'founding', label: 'Founding plan (setup + first month)' },
  { key: 'standard', label: 'Standard plan (setup + first month)' },
  { key: 'minutes200', label: '200 voice minutes' },
  { key: 'minutes500', label: '500 voice minutes' },
  { key: 'other', label: 'Something else' },
]

/** Admin: write down a payment that did not go through Whop (bank transfer, cash) so the sales numbers stay complete. */
export function ManualPaymentForm({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter()
  const [businessId, setBusinessId] = useState('')
  const [plan, setPlan] = useState('founding')
  const [amount, setAmount] = useState('')
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [apply, setApply] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function submit() {
    setBusy(true); setMsg('')
    try {
      const res = await fetch('/api/admin/billing/manual', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: businessId || undefined, plan, amount: Number(amount), paidAt, note, apply }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) { setMsg(data.error || 'Could not save.'); return }
      setAmount(''); setNote(''); setMsg('Saved.')
      router.refresh()
    } finally { setBusy(false) }
  }

  const input = 'rounded-md border border-input bg-input/30 px-2 py-1.5 text-xs'
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm font-medium">Record a payment received outside Whop</p>
      <p className="mt-1 text-xs text-muted-foreground">For bank transfers or cash. It appears in your totals and can switch billing on or add the minutes for you.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">Client
          <select className={`${input} mt-1 w-full`} value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
            <option value="">(no client yet)</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">What was paid for
          <select className={`${input} mt-1 w-full`} value={plan} onChange={(e) => setPlan(e.target.value)}>
            {WHAT.map((w) => <option key={w.key} value={w.key}>{w.label}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">Amount (USD)
          <input className={`${input} mt-1 w-full`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="348" />
        </label>
        <label className="text-xs text-muted-foreground">Date received
          <input type="date" className={`${input} mt-1 w-full`} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </label>
        <label className="text-xs text-muted-foreground sm:col-span-2">Note
          <input className={`${input} mt-1 w-full`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Payoneer transfer, ref 12345" />
        </label>
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} />
        Also apply it: set billing to active for a plan, or add the minutes for a pack
      </label>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" onClick={submit} disabled={busy} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60">{busy ? 'Saving…' : 'Save payment'}</button>
        {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
      </div>
    </div>
  )
}
