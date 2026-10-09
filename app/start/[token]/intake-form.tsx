'use client'

import { useState } from 'react'

const input = 'w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm outline-none focus-visible:border-ring'

interface Initial {
  industry: string; website: string; phone: string; address: string; hoursText: string
  servicesText: string; faqsText: string; policiesText: string; notifyEmail: string
}
interface Done { snippet: string | null; loginUrl: string; services: string }

export function IntakeForm({ token, services, loginEmail, initial, prefilled }: { token: string; services: string; loginEmail: string; initial: Initial; prefilled: boolean }) {
  const [f, setF] = useState({ ...initial, webhookUrl: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<Done | null>(null)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const res = await fetch(`/api/intake/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
      const data = await res.json()
      if (!data.success) { setError(data.error ?? 'Something went wrong.'); return }
      setDone({ snippet: data.snippet, loginUrl: data.loginUrl, services: data.services })
    } finally { setBusy(false) }
  }

  if (done) {
    return (
      <div className="space-y-5 text-sm">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="font-medium">You&apos;re all set.</p>
          <p className="mt-1 text-muted-foreground">We&apos;ve emailed you a copy of these steps.</p>
        </div>
        {done.snippet ? (
          <div className="rounded-xl border border-border bg-card p-5 space-y-2">
            <p className="font-medium">1. Put the assistant on your website</p>
            <p className="text-xs text-muted-foreground">Paste this single line into your site (before the closing body tag, or in your site builder&apos;s &quot;custom code&quot; / &quot;header&quot; box). Not sure how? Send this page to whoever manages your website, or reply to us and we&apos;ll do it with you.</p>
            <pre className="overflow-x-auto rounded-lg bg-secondary p-3 text-xs">{done.snippet}</pre>
          </div>
        ) : null}
        {done.services !== 'chat' ? (
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="font-medium">{done.snippet ? '2. ' : '1. '}Your phone assistant</p>
            <p className="mt-1 text-xs text-muted-foreground">We&apos;ll email you your phone number shortly, with simple steps to forward your calls to it.</p>
          </div>
        ) : null}
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="font-medium">See your enquiries</p>
          <p className="mt-1 text-xs text-muted-foreground">Log in at <a className="text-primary underline underline-offset-4" href={done.loginUrl}>{done.loginUrl}</a> with <b>{loginEmail}</b> and the password you just chose.</p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-6 text-sm">
      {prefilled ? <p className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">We pre-filled this from your website. Please correct anything that&apos;s wrong or missing.</p> : null}

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <p className="font-medium">Your business</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5"><span className="font-medium">What kind of business? *</span><input required className={input} placeholder="Dentist, plumber, salon…" value={f.industry} onChange={set('industry')} /></label>
          <label className="space-y-1.5"><span className="font-medium">Website</span><input className={input} value={f.website} onChange={set('website')} /></label>
          <label className="space-y-1.5"><span className="font-medium">Phone</span><input className={input} value={f.phone} onChange={set('phone')} /></label>
          <label className="space-y-1.5"><span className="font-medium">Address</span><input className={input} value={f.address} onChange={set('address')} /></label>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <p className="font-medium">What your assistant should know</p>
        <label className="block space-y-1.5"><span className="font-medium">Opening hours <span className="font-normal text-muted-foreground">(one line each)</span></span>
          <textarea className={input + ' min-h-20 font-mono text-xs'} placeholder={'Mon-Fri 9am-5pm\nSat 10am-2pm\nSun closed'} value={f.hoursText} onChange={set('hoursText')} /></label>
        <label className="block space-y-1.5"><span className="font-medium">Services <span className="font-normal text-muted-foreground">(one per line: name | price | minutes | short description. Price and minutes are optional)</span></span>
          <textarea className={input + ' min-h-24 font-mono text-xs'} placeholder={'Cleaning | $120 | 45 | Standard cleaning and exam'} value={f.servicesText} onChange={set('servicesText')} /></label>
        <label className="block space-y-1.5"><span className="font-medium">Common questions <span className="font-normal text-muted-foreground">(one per line: question | answer)</span></span>
          <textarea className={input + ' min-h-24 font-mono text-xs'} placeholder={'Do you take insurance? | Yes, most PPO plans.'} value={f.faqsText} onChange={set('faqsText')} /></label>
        <label className="block space-y-1.5"><span className="font-medium">Rules to mention <span className="font-normal text-muted-foreground">(optional, one per line)</span></span>
          <textarea className={input + ' min-h-16 font-mono text-xs'} placeholder={'24-hour cancellation notice.'} value={f.policiesText} onChange={set('policiesText')} /></label>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <p className="font-medium">Where to send enquiries, and your login</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5"><span className="font-medium">Email for new enquiries *</span><input required type="email" className={input} value={f.notifyEmail} onChange={set('notifyEmail')} /></label>
          <label className="space-y-1.5"><span className="font-medium">Your login email</span><input disabled className={input + ' opacity-70'} value={loginEmail} readOnly /></label>
          <label className="space-y-1.5 sm:col-span-2"><span className="font-medium">Choose a password * <span className="font-normal text-muted-foreground">(at least 10 characters)</span></span><input required type="password" autoComplete="new-password" minLength={10} className={input} value={f.password} onChange={set('password')} /></label>
          <label className="space-y-1.5 sm:col-span-2"><span className="font-medium">Send enquiries to another system too? <span className="font-normal text-muted-foreground">(optional: paste a webhook URL from Zapier, Make, your CRM…)</span></span><input className={input} placeholder="https://" value={f.webhookUrl} onChange={set('webhookUrl')} /></label>
        </div>
        {services !== 'chat' ? <p className="text-xs text-muted-foreground">Your phone assistant is included. We&apos;ll send your number after this step.</p> : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <button type="submit" disabled={busy} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">{busy ? 'Saving…' : 'Finish setup'}</button>
    </form>
  )
}
