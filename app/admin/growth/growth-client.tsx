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
        {[['all', 'Run full cycle'], ['discover', 'Find leads'], ['enrich', 'Find emails'], ['draft', 'Write emails'], ...(manual ? [] : [['send', 'Send approved']])].map(([t, label]) => (
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
