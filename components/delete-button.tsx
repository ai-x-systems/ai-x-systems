'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Two-step delete: click, read what will happen, then confirm. For big things (a whole client) the person
 * must also type the exact id. A 409 from the server (e.g. "still has an active subscription") offers a
 * clearly labelled "Delete anyway".
 */
export function DeleteButton({
  endpoint,
  label = 'Delete',
  warning,
  typeToConfirm,
  allowForce = false,
  className = 'text-xs text-destructive underline underline-offset-4',
}: {
  endpoint: string
  label?: string
  warning?: string
  typeToConfirm?: string
  allowForce?: boolean
  className?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [canForce, setCanForce] = useState(false)

  async function run(force: boolean) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(typeToConfirm ? { confirm: typed, force } : { force }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error || 'Could not delete.')
        setCanForce(allowForce && res.status === 409)
        return
      }
      setOpen(false)
      router.refresh()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return <button type="button" className={className} onClick={() => setOpen(true)}>{label}</button>
  }
  const mismatch = !!typeToConfirm && typed !== typeToConfirm
  return (
    <div className="mt-1 max-w-xs rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs">
      <p className="text-foreground">{warning ?? 'This cannot be undone.'}</p>
      {typeToConfirm ? (
        <label className="mt-2 block text-muted-foreground">
          Type <span className="font-mono text-foreground">{typeToConfirm}</span> to confirm
          <input value={typed} onChange={(e) => setTyped(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-input/30 px-2 py-1 text-xs" />
        </label>
      ) : null}
      {error ? <p className="mt-2 text-destructive">{error}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy || mismatch} onClick={() => run(false)} className="rounded-md bg-destructive px-2 py-1 text-xs font-medium text-white disabled:opacity-50">
          {busy ? 'Deleting…' : 'Delete forever'}
        </button>
        {canForce ? (
          <button type="button" disabled={busy || mismatch} onClick={() => run(true)} className="text-xs text-destructive underline underline-offset-4 disabled:opacity-50">Delete anyway</button>
        ) : null}
        <button type="button" onClick={() => { setOpen(false); setError(''); setTyped('') }} className="text-xs text-muted-foreground underline underline-offset-4">Cancel</button>
      </div>
    </div>
  )
}
