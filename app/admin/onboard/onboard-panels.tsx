'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

const input = 'w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm outline-none focus-visible:border-ring'

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button type="button" className="text-xs text-primary underline underline-offset-4"
      onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500) }}>
      {done ? 'Copied' : label}
    </button>
  )
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return res.json()
}

/** Recommended path: the client finishes their own setup through a private link. */
export function IntakePanel() {
  const [f, setF] = useState({ businessName: '', clientEmail: '', services: 'chat', website: '', paid: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ link: string; expiresInDays: number; prefilled: boolean } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const data = await post('/api/admin/clients/intake', f)
      if (!data.success) { setError(data.error ?? 'Failed'); return }
      setResult(data)
    } finally { setBusy(false) }
  }

  if (result) {
    const msg = `Hi! Thanks for choosing us. To set up your AI receptionist, please fill in this short form (about 5 minutes). It's pre-filled where we could, so just check the details:\n\n${result.link}\n\nThe link works for ${result.expiresInDays} days. Once you finish, you'll get your install line and your dashboard login.`
    return (
      <div className="space-y-4 text-sm">
        <div className="rounded-xl border border-border bg-card p-5 space-y-2">
          <p className="font-medium">Link created {result.prefilled ? '(pre-filled from their website)' : '(blank form)'}</p>
          <pre className="whitespace-pre-wrap rounded-lg bg-secondary p-3 text-xs">{msg}</pre>
          <Copy text={msg} label="Copy message" />
        </div>
        <p className="text-xs text-muted-foreground">You&apos;ll get an email when they finish. Voice clients still need a phone number attached in /admin/voice and minutes added.</p>
        <Button size="sm" variant="outline" onClick={() => { setResult(null); setF({ businessName: '', clientEmail: '', services: 'chat', website: '', paid: false }) }}>Create another</Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4 text-sm">
      <p className="text-xs text-muted-foreground">The client fills in their own hours, services and login. You send one link.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5"><span className="font-medium">Business name *</span><input required className={input} value={f.businessName} onChange={(e) => setF({ ...f, businessName: e.target.value })} /></label>
        <label className="space-y-1.5"><span className="font-medium">Client email * <span className="font-normal text-muted-foreground">(their login, and the email they pay from)</span></span><input required type="email" className={input} value={f.clientEmail} onChange={(e) => setF({ ...f, clientEmail: e.target.value })} /></label>
        <label className="space-y-1.5"><span className="font-medium">What did they buy?</span>
          <select className={input} value={f.services} onChange={(e) => setF({ ...f, services: e.target.value })}>
            <option value="chat">Website chat</option><option value="voice">Phone assistant</option><option value="both">Both</option>
          </select></label>
        <label className="space-y-1.5"><span className="font-medium">Their website <span className="font-normal text-muted-foreground">(pre-fills the form)</span></span><input className={input} placeholder="https://" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} /></label>
      </div>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.paid} onChange={(e) => setF({ ...f, paid: e.target.checked })} /> Payment already received (billing starts as active)</label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create intake link'}</Button>
    </form>
  )
}

/** For a prospect who replied: a private preview built from their website in ~15 seconds. */
export function PreviewPanel() {
  const [f, setF] = useState({ website: '', name: '', industry: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ tryUrl: string; businessId: string; name: string } | null>(null)
  const [lineMsg, setLineMsg] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setLineMsg('')
    try {
      const data = await post('/api/admin/clients/demo', f)
      if (!data.success) { setError(data.error ?? 'Failed'); return }
      setResult(data)
    } finally { setBusy(false) }
  }

  async function useLine() {
    const data = await post('/api/admin/voice/demo-line', { businessId: result!.businessId })
    setLineMsg(data.success ? 'Demo phone line now answers as this business.' : data.error ?? 'Failed')
  }

  if (result) {
    const msg = `Hi! I built a working preview of an AI receptionist for ${result.name} from what's public on your website. Try asking it something a customer would:\n\n${result.tryUrl}`
    return (
      <div className="space-y-4 text-sm">
        <div className="rounded-xl border border-border bg-card p-5 space-y-2">
          <p className="font-medium">Preview ready</p>
          <a className="break-all text-xs text-primary underline underline-offset-4" href={result.tryUrl} target="_blank" rel="noreferrer">{result.tryUrl}</a>
          <pre className="whitespace-pre-wrap rounded-lg bg-secondary p-3 text-xs">{msg}</pre>
          <Copy text={msg} label="Copy message" />
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-2">
          <p className="font-medium">Phone demo</p>
          <p className="text-xs text-muted-foreground">There is one shared demo number. Point it at this business just before they call. Calls are capped at 2 minutes and free to them.</p>
          <Button size="sm" variant="outline" onClick={useLine}>Point the demo line at this preview</Button>
          {lineMsg ? <p className="text-xs text-muted-foreground">{lineMsg}</p> : null}
        </div>
        <Button size="sm" variant="outline" onClick={() => { setResult(null); setF({ website: '', name: '', industry: '' }) }}>Create another</Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4 text-sm">
      <p className="text-xs text-muted-foreground">Needs a public website that states opening hours and at least a service or FAQ. Takes about 15 seconds.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 sm:col-span-2"><span className="font-medium">Their website *</span><input required className={input} placeholder="https://" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} /></label>
        <label className="space-y-1.5"><span className="font-medium">Business name <span className="font-normal text-muted-foreground">(optional)</span></span><input className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="space-y-1.5"><span className="font-medium">Industry <span className="font-normal text-muted-foreground">(optional)</span></span><input className={input} value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} /></label>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={busy}>{busy ? 'Building preview…' : 'Create preview'}</Button>
    </form>
  )
}
