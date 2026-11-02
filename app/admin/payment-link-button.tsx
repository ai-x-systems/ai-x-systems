'use client'

import { useState } from 'react'
import { toast } from '@/lib/toast'

const PLANS: { key: string; label: string }[] = [
  { key: 'founding', label: 'Founding: $348 today, then $149/mo' },
  { key: 'standard', label: 'Standard: $448 today, then $149/mo' },
  { key: 'minutes200', label: '200 voice minutes: $50' },
  { key: 'minutes500', label: '500 voice minutes: $110' },
]

/** Admin: make a Whop payment link for one client. The client's id is attached, so the webhook credits the right account. */
export function PaymentLinkButton({ businessId }: { businessId: string }) {
  const [plan, setPlan] = useState('founding')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function create() {
    setLoading(true)
    setError('')
    setUrl('')
    setCopied(false)
    try {
      const res = await fetch('/api/admin/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, plan }),
      })
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not create the link.')
      setUrl(data.url)
      toast('Payment link created. Copy it below.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the link.')
    } finally {
      setLoading(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast('Link copied')
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="flex flex-col gap-2">
        <select className="w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm" value={plan} onChange={(e) => setPlan(e.target.value)}>
          {PLANS.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
        <button type="button" onClick={create} disabled={loading} className="btn btn-primary btn-sm w-full">
          {loading ? 'Creating…' : 'Create payment link'}
        </button>
      </div>
      {url ? (
        <div className="flex items-center gap-2">
          <input readOnly value={url} className="min-w-0 flex-1 rounded-lg border border-input bg-input/30 px-3 py-2 text-xs" onFocus={(e) => e.currentTarget.select()} />
          <button type="button" onClick={copy} className="text-xs text-primary underline underline-offset-4">{copied ? 'Copied' : 'Copy'}</button>
        </div>
      ) : null}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  )
}
