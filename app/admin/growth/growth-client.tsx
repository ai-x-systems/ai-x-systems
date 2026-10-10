'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

const input = 'w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm outline-none focus-visible:border-ring'

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return res.json()
}

export function RunButtons({ manual }: { manual: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<string>('')

  async function run(task: string) {
    setBusy(task); setResult('')
    try {
      const data = await post('/api/admin/growth/run', { task })
      setResult(data.success ? JSON.stringify(data.result) : data.error ?? 'Failed')
      router.refresh()
    } finally { setBusy(null) }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {[['all', 'Run full cycle'], ['discover', 'Find leads'], ['enrich', 'Find emails'], ['demo', 'Build previews'], ['draft', 'Write emails'], ...(manual ? [] : [['send', 'Send approved']])].map(([t, label]) => (
          <Button key={t} size="sm" variant={t === 'all' ? 'default' : 'outline'} disabled={!!busy} onClick={() => run(t)}>
            {busy === t ? 'Running…' : label}
          </Button>
        ))}
      </div>
      {result ? <p className="mt-2 break-all text-xs text-muted-foreground">{result}</p> : null}
    </div>
  )
}

export interface SettingsShape {
  sendMode: 'manual' | 'auto'; autoSend: boolean; dailySendCap: number; industries: string[]; cities: string[]
  country: string; offer: 'chat' | 'voice'; senderName: string; discoverPerRun: number
}

export function SettingsForm({ initial }: { initial: SettingsShape }) {
  const router = useRouter()
  const [s, setS] = useState({ ...initial, industries: initial.industries.join(', '), cities: initial.cities.join(', ') })
  const [msg, setMsg] = useState('')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const data = await post('/api/admin/growth/settings', s)
    setMsg(data.success ? 'Saved.' : data.error ?? 'Failed')
    router.refresh()
  }

  return (
    <form onSubmit={save} className="space-y-4 text-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5"><span className="font-medium">Industries (comma separated)</span>
          <input className={input} value={s.industries} onChange={(e) => setS({ ...s, industries: e.target.value })} /></label>
        <label className="space-y-1.5"><span className="font-medium">Cities (comma separated)</span>
          <input className={input} placeholder="Austin TX, Dallas TX" value={s.cities} onChange={(e) => setS({ ...s, cities: e.target.value })} /></label>
        <label className="space-y-1.5"><span className="font-medium">Sender first name</span>
          <input className={input} value={s.senderName} onChange={(e) => setS({ ...s, senderName: e.target.value })} /></label>
        <label className="space-y-1.5"><span className="font-medium">Max emails per day</span>
          <input className={input} type="number" min={1} max={200} value={s.dailySendCap} onChange={(e) => setS({ ...s, dailySendCap: Number(e.target.value) })} /></label>
        <label className="space-y-1.5"><span className="font-medium">Target country (2-letter)</span>
          <input className={input} maxLength={2} value={s.country} onChange={(e) => setS({ ...s, country: e.target.value })} /></label>
        <label className="space-y-1.5"><span className="font-medium">What the emails offer</span>
          <select className={input} value={s.offer} onChange={(e) => setS({ ...s, offer: e.target.value as 'chat' | 'voice' })}>
            <option value="chat">Website AI receptionist (live today)</option>
            <option value="voice">Phone + website (only once Voice is built)</option>
          </select></label>
      </div>
      <label className="block space-y-1.5"><span className="font-medium">How emails are sent</span>
        <select className={input} value={s.sendMode} onChange={(e) => setS({ ...s, sendMode: e.target.value as 'manual' | 'auto' })}>
          <option value="manual">Manual: I copy each email and send it from my own mailbox (recommended)</option>
          <option value="auto">Automatic: the system sends (needs your own domain and a sending service)</option>
        </select></label>
      {s.sendMode === 'auto' ? (
        <label className="flex items-start gap-3 rounded-lg border border-border p-3">
          <input type="checkbox" className="mt-1" checked={s.autoSend} onChange={(e) => setS({ ...s, autoSend: e.target.checked })} />
          <span><span className="font-medium">Skip the approval queue</span><br />
            <span className="text-xs text-muted-foreground">Off: each email waits for one click. On: emails go out on their own within the warm-up limit.</span></span>
        </label>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm">Save settings</Button>
        {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
      </div>
    </form>
  )
}

export function QueueItem({ id, to, business, subject, body, step, manual, footer }: { id: string; to: string; business: string; subject: string; body: string; step: number; manual: boolean; footer: string }) {
  const router = useRouter()
  const [sub, setSub] = useState(subject)
  const [text, setText] = useState(body)
  const [open, setOpen] = useState(false)

  const [copied, setCopied] = useState(false)

  async function act(action: 'approve' | 'skip' | 'sent_manually') {
    await post(`/api/admin/growth/messages/${id}`, { action, subject: sub, bodyText: text })
    router.refresh()
  }

  async function copyAll() {
    await navigator.clipboard.writeText(`To: ${to}\nSubject: ${sub}\n\n${text}${footer}`)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><span className="font-medium">{business}</span> <span className="text-xs text-muted-foreground">→ {to} · step {step}/3</span></div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Review / edit'}</Button>
          <Button size="sm" variant="outline" onClick={() => act('skip')}>Skip</Button>
          {manual ? (
            <>
              <Button size="sm" variant="outline" onClick={copyAll}>{copied ? 'Copied' : 'Copy email'}</Button>
              <Button size="sm" onClick={() => act('sent_manually')}>I sent it</Button>
            </>
          ) : (
            <Button size="sm" onClick={() => act('approve')}>Approve</Button>
          )}
        </div>
      </div>
      {open ? (
        <div className="mt-3 space-y-2">
          <input className={input} value={sub} onChange={(e) => setSub(e.target.value)} />
          <textarea className={input + ' min-h-48 font-mono text-xs'} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      ) : <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{subject}</p>}
    </div>
  )
}

export function LeadActions({ id, stage }: { id: string; stage: string }) {
  const router = useRouter()
  async function act(action: string) { await post(`/api/admin/growth/leads/${id}`, { action }); router.refresh() }
  const closed = ['won', 'lost', 'unsubscribed', 'bounced'].includes(stage)
  return (
    <div className="flex flex-wrap gap-1.5">
      {!closed && <button className="text-xs text-primary underline underline-offset-4" onClick={() => act('replied')}>Replied</button>}
      {!closed && <button className="text-xs text-primary underline underline-offset-4" onClick={() => act('demo_booked')}>Demo booked</button>}
      {stage !== 'won' && <button className="text-xs text-primary underline underline-offset-4" onClick={() => act('won')}>Won</button>}
      {!closed && <button className="text-xs text-muted-foreground underline underline-offset-4" onClick={() => act('lost')}>Lost</button>}
      {!closed && <button className="text-xs text-muted-foreground underline underline-offset-4" onClick={() => act('suppress')}>Never contact</button>}
    </div>
  )
}

export function PreviewLinks({ businessId }: { businessId?: string }) {
  const [msg, setMsg] = useState('')
  if (!businessId) return <span className="text-xs text-muted-foreground">none</span>
  async function useLine() {
    const data = await post('/api/admin/voice/demo-line', { businessId })
    setMsg(data.success ? 'Demo line moved here' : data.error ?? 'Failed')
  }
  return (
    <div className="flex flex-col gap-1">
      <a href={`/try/${businessId}`} target="_blank" rel="noreferrer" className="text-xs text-primary underline underline-offset-4">Open preview</a>
      <button className="text-left text-xs text-muted-foreground underline underline-offset-4" onClick={useLine}>Use demo line</button>
      {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
    </div>
  )
}

export function AddLeadsForm({ defaultIndustry }: { defaultIndustry: string }) {
  const router = useRouter()
  const [f, setF] = useState({ text: '', industry: defaultIndustry, city: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [rejected, setRejected] = useState<Array<{ line: string; reason: string }>>([])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(''); setRejected([])
    try {
      const data = await post('/api/admin/growth/leads/add', f)
      if (!data.success) { setMsg(data.error ?? 'Failed'); return }
      setMsg(`Added ${data.added}${data.updated ? `, ${data.updated} completed with the email you gave` : ''}${data.duplicates ? `, ${data.duplicates} already in the list` : ''}. Press "Run full cycle" (or wait for the daily run) to find emails, build previews and write the emails.`)
      setRejected(data.rejected ?? [])
      if (data.added || data.updated) { setF({ ...f, text: '' }); router.refresh() }
    } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-3 text-sm">
      <p className="text-xs text-muted-foreground">One business per line: <code>website | name (optional) | email (optional)</code>. A bare domain works too. If you add the email, the system skips the email search.</p>
      <textarea required className={input + ' min-h-32 font-mono text-xs'} placeholder={'brightsmile.com | Bright Smile Dental\nacmeplumbing.com\nhttps://www.cityhvac.net | City HVAC | office@cityhvac.net'} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5"><span className="font-medium">Industry (used in the email)</span><input className={input} value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} /></label>
        <label className="space-y-1.5"><span className="font-medium">City (optional)</span><input className={input} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></label>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={busy}>{busy ? 'Adding…' : 'Add leads'}</Button>
        {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
      </div>
      {rejected.length ? (
        <ul className="text-xs text-destructive">{rejected.map((r, i) => <li key={i}>{r.line}: {r.reason}</li>)}</ul>
      ) : null}
    </form>
  )
}
