'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CreateClientForm() {
  const router = useRouter()
  const [businessId, setBusinessId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setNotice(null)

    try {
      const res = await fetch('/api/admin/clients/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, email, password }),
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.error ?? 'Could not create client account.')
        return
      }

      setNotice(`Created login for ${email}. Share these credentials with the client directly.`)
      setBusinessId('')
      setEmail('')
      setPassword('')
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const field = 'mt-1 w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm'
  return (
    <div className="card p-5">
      <p className="text-sm font-medium">Create a client login</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Makes the account directly. You stay logged in as admin and the client does not need to sign up.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <label className="block text-xs text-muted-foreground">
          Business ID
          <input required value={businessId} onChange={(e) => setBusinessId(e.target.value)} placeholder="e.g. site-audit-fast" className={field} />
        </label>
        <label className="block text-xs text-muted-foreground">
          Client email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@theirbusiness.com" className={field} />
        </label>
        <label className="block text-xs text-muted-foreground">
          Temporary password (8+ characters)
          <input type="text" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
        </label>
        <button type="submit" disabled={loading} className="btn btn-primary btn-sm w-full">
          {loading ? 'Creating…' : 'Create login'}
        </button>
      </form>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-primary">{notice}</p> : null}
    </div>
  )
}
