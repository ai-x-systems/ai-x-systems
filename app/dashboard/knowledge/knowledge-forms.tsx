'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Faq = { question: string; answer: string }
const input = 'mt-1 w-full rounded-md border border-input bg-input/30 px-3 py-2 text-sm'

/** Questions and answers the assistant uses on chat AND on the phone. Saved changes apply within about a minute. */
export function FaqEditor({ initial }: { initial: Faq[] }) {
  const router = useRouter()
  const [faqs, setFaqs] = useState<Faq[]>(initial.length ? initial : [{ question: '', answer: '' }])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const update = (i: number, patch: Partial<Faq>) => setFaqs(faqs.map((f, n) => (n === i ? { ...f, ...patch } : f)))

  async function save() {
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/client/faqs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ faqs }) })
      const data = (await res.json().catch(() => ({}))) as { error?: string; count?: number }
      setMsg(res.ok ? { ok: true, text: `Saved ${data.count ?? ''} answer(s). It may take up to a minute to take effect.` } : { ok: false, text: data.error || 'Could not save.' })
      if (res.ok) router.refresh()
    } finally { setBusy(false) }
  }

  return (
    <div>
      <ul className="space-y-4">
        {faqs.map((f, i) => (
          <li key={i} className="rounded-lg border border-border p-3">
            <label className="block text-xs text-muted-foreground">Question
              <input className={input} value={f.question} maxLength={300} onChange={(e) => update(i, { question: e.target.value })} placeholder="Do you offer free estimates?" />
            </label>
            <label className="mt-2 block text-xs text-muted-foreground">Answer
              <textarea className={`${input} min-h-[72px]`} value={f.answer} maxLength={1500} onChange={(e) => update(i, { answer: e.target.value })} placeholder="Yes, for most jobs. We'll confirm when we call you back." />
            </label>
            <button type="button" onClick={() => setFaqs(faqs.filter((_, n) => n !== i))} className="mt-2 text-xs text-destructive underline underline-offset-4">Remove</button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setFaqs([...faqs, { question: '', answer: '' }])} disabled={faqs.length >= 60} className="rounded-md border border-input px-3 py-1.5 text-xs hover:bg-muted">+ Add a question</button>
        <button type="button" onClick={save} disabled={busy} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">{busy ? 'Saving…' : 'Save answers'}</button>
        {msg ? <span className={`text-xs ${msg.ok ? 'text-primary' : 'text-destructive'}`}>{msg.text}</span> : null}
      </div>
    </div>
  )
}

/** For things that need a person (hours, services, prices, policies): sends you a note. */
export function ChangeRequestForm() {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function send() {
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/client/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'change_request', message }) })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setMsg(res.ok ? { ok: true, text: "Sent. We'll make the change and confirm by email." } : { ok: false, text: data.error || 'Could not send.' })
      if (res.ok) setMessage('')
    } finally { setBusy(false) }
  }

  return (
    <div>
      <textarea className={`${input} min-h-[96px]`} value={message} maxLength={2000} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. We now close at 4pm on Fridays, and our emergency call-out fee is $120." />
      <div className="mt-3 flex items-center gap-3">
        <button type="button" onClick={send} disabled={busy || message.trim().length < 5} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">{busy ? 'Sending…' : 'Send change request'}</button>
        {msg ? <span className={`text-xs ${msg.ok ? 'text-primary' : 'text-destructive'}`}>{msg.text}</span> : null}
      </div>
    </div>
  )
}
