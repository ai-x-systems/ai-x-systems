'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'

type Entry = { id: string; amount: number; type: string; note: string; at: string }

/**
 * Voice minutes for one client (1 credit = 1 minute).
 *  - Type a number and Save: a plus adds minutes, a minus removes them. The note is just a label in the history.
 *  - "Set to 0" (or any number) fixes a wrong balance in one click.
 *  - "History" lists the last entries; "Undo" deletes a mistaken one completely.
 */
export function CreditAdjustForm({ businessId, balance, history }: { businessId: string; balance: number; history: Entry[] }) {
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [error, setError] = useState('')
  const endpoint = `/api/admin/clients/${businessId}/credits`

  async function send(init: RequestInit, url = endpoint) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(url, init)
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) { setError(data.error || 'Could not save.'); toast(data.error || 'Could not save.', 'error'); return false }
      toast('Minutes updated')
      router.refresh()
      return true
    } catch {
      setError('Could not reach the server.')
      return false
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = Number(amount)
    if (!parsed) return
    const ok = await send({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: parsed > 0 ? 'manual_topup' : 'adjustment', amount: parsed, note: note || undefined }),
    })
    if (ok) { setAmount(''); setNote('') }
  }

  async function setBalance(target: number) {
    if (!window.confirm(`Set this client's minutes to ${target}? (They have ${balance} now.)`)) return
    await send({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set', target, note: note || undefined }) })
  }

  async function undo(entry: Entry) {
    if (!window.confirm(`Delete this entry (${entry.amount > 0 ? '+' : ''}${entry.amount} minutes)? The balance changes by ${-entry.amount}.`)) return
    await send({ method: 'DELETE' }, `${endpoint}?id=${encodeURIComponent(entry.id)}`)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-1.5">
        <input
          type="number"
          placeholder="+ add / − remove"
          title="Minutes to add (plus) or remove (minus)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-28 rounded-md border border-input bg-input/30 px-2 py-1 text-xs outline-none focus-visible:border-ring"
        />
        <input
          type="text"
          placeholder="Note (why / payment ref)"
          title="A label saved with this change, e.g. Payoneer PR-0142 or 'added by mistake'"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-40 rounded-md border border-input bg-input/30 px-2 py-1 text-xs outline-none focus-visible:border-ring"
        />
        <Button type="submit" size="xs" variant="outline" disabled={loading || !amount}>
          Save
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {balance !== 0 ? (
          <button type="button" disabled={loading} onClick={() => setBalance(0)} className="text-destructive underline underline-offset-4">Set to 0</button>
        ) : null}
        <button type="button" onClick={() => setShowHistory(!showHistory)} className="text-primary underline underline-offset-4">{showHistory ? 'Hide history' : 'History'}</button>
      </div>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
      {showHistory ? (
        history.length === 0 ? (
          <span className="text-xs text-muted-foreground">No minute changes yet.</span>
        ) : (
          <ul className="max-w-xs divide-y divide-border rounded-lg border border-border bg-card text-xs">
            {history.map((h) => (
              <li key={h.id} className="flex items-start justify-between gap-2 px-2 py-1.5">
                <span>
                  <span className={h.amount > 0 ? 'font-medium text-primary' : 'font-medium'}>{h.amount > 0 ? '+' : ''}{h.amount}</span>
                  <span className="ml-1 text-muted-foreground">{h.note || h.type} · {new Date(h.at).toLocaleDateString()}</span>
                </span>
                <button type="button" disabled={loading} onClick={() => undo(h)} className="shrink-0 text-destructive underline underline-offset-4">Undo</button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  )
}
