'use client'

import { useState } from 'react'

export function TestEmailButton({ defaultEmail }: { defaultEmail: string }) {
  const [email, setEmail] = useState(defaultEmail)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null)

  async function handleSend() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ success: false, error: 'Request failed.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-5">
      <p className="text-sm font-medium">Test email delivery</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Sends a real test email through your Gmail settings so you can confirm lead and payment alerts will arrive.
      </p>
      <label className="mt-4 block text-xs text-muted-foreground">
        Send it to
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm" />
      </label>
      <button type="button" onClick={handleSend} disabled={loading || !email} className="btn btn-primary btn-sm mt-3 w-full">
        {loading ? 'Sending…' : 'Send test email'}
      </button>
      {result ? (
        <p className={`mt-3 text-sm ${result.success ? 'text-primary' : 'text-destructive'}`}>
          {result.success ? 'Sent. Check the inbox.' : `Failed: ${result.error}`}
        </p>
      ) : null}
    </div>
  )
}
