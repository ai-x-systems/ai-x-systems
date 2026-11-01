'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const input = 'mt-1 w-full rounded-md border border-input bg-input/30 px-3 py-2 text-sm'
const primary = 'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60'

async function post(body: Record<string, unknown>) {
  const res = await fetch('/api/client/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  return { ok: res.ok, error: data.error }
}

function useAction() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  async function run(body: Record<string, unknown>, okText: string, after?: () => void) {
    setBusy(true); setMsg(null)
    try {
      const r = await post(body)
      setMsg({ ok: r.ok, text: r.ok ? okText : r.error || 'Something went wrong.' })
      if (r.ok) after?.()
    } finally { setBusy(false) }
  }
  const note = msg ? <span className={`text-xs ${msg.ok ? 'text-primary' : 'text-destructive'}`}>{msg.text}</span> : null
  return { busy, run, note }
}

export function ProfileForm({ initial }: { initial: { name: string; phone: string; address: string; website: string } }) {
  const router = useRouter()
  const [v, setV] = useState(initial)
  const { busy, run, note } = useAction()
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value })
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">Business name<input className={input} value={v.name} onChange={set('name')} /></label>
        <label className="text-xs text-muted-foreground">Phone<input className={input} value={v.phone} onChange={set('phone')} /></label>
        <label className="text-xs text-muted-foreground">Address<input className={input} value={v.address} onChange={set('address')} /></label>
        <label className="text-xs text-muted-foreground">Website<input className={input} value={v.website} onChange={set('website')} /></label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" className={primary} disabled={busy} onClick={() => run({ action: 'profile', ...v }, 'Saved.', () => router.refresh())}>{busy ? 'Saving…' : 'Save details'}</button>
        {note}
      </div>
    </div>
  )
}

export function PauseControl({ active }: { active: boolean }) {
  const router = useRouter()
  const { busy, run, note } = useAction()
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className={active ? 'rounded-md border border-input px-4 py-2 text-sm hover:bg-muted disabled:opacity-60' : primary} disabled={busy}
        onClick={() => { if (!active || window.confirm('Pause the assistant? It will stop answering chats and calls until you turn it back on.')) run({ action: active ? 'pause' : 'resume' }, active ? 'Paused.' : 'Back on.', () => router.refresh()) }}>
        {busy ? 'Working…' : active ? 'Pause my assistant' : 'Turn my assistant back on'}
      </button>
      {note}
    </div>
  )
}

export function PasswordForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const { busy, run, note } = useAction()
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">Current password<input className={input} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></label>
        <label className="text-xs text-muted-foreground">New password (10+ characters)<input className={input} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" className={primary} disabled={busy || !current || next.length < 10} onClick={() => run({ action: 'password', current, next }, 'Password changed.', () => { setCurrent(''); setNext('') })}>{busy ? 'Saving…' : 'Change password'}</button>
        {note}
      </div>
    </div>
  )
}

export function DeleteAccountRequest() {
  const [open, setOpen] = useState(false)
  const { busy, run, note } = useAction()
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-sm text-destructive underline underline-offset-4">Delete my account and data</button>
  return (
    <div className="max-w-md rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <p>We will delete your login, leads, call history and settings. If you have an active subscription, cancel it first on the Billing tab. We confirm by email when it is done.</p>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" disabled={busy} onClick={() => run({ action: 'delete_request' }, 'Request sent. We will confirm by email.')} className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">{busy ? 'Sending…' : 'Send deletion request'}</button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground underline underline-offset-4">Never mind</button>
        {note}
      </div>
    </div>
  )
}
