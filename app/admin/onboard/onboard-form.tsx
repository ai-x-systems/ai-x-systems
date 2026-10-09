'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

const input = 'w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm outline-none focus-visible:border-ring'

interface Result {
  businessId: string
  login: { email: string; password: string; url: string }
  snippet: string
  hostedChatUrl: string
  checkoutUrl: string | null
  servicesParsed: number
  faqsParsed: number
}

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button type="button" className="text-xs text-primary underline underline-offset-4"
      onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500) }}>
      {done ? 'Copied' : label}
    </button>
  )
}

const empty = {
  name: '', industry: '', website: '', phone: '', address: '', notifyEmail: '', clientEmail: '',
  services: 'chat', assistantName: 'Ava', tone: 'friendly', timezone: 'America/Chicago',
  hoursText: '', servicesText: '', faqsText: '', policiesText: '', webhookUrl: '', leadSheetId: '',
}

export function OnboardForm() {
  const [f, setF] = useState(empty)
  const [busy, setBusy] = useState<'draft' | 'save' | null>(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })

  async function draft() {
    setBusy('draft'); setError(''); setNote('')
    try {
      const res = await fetch('/api/admin/clients/draft-from-website', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: f.website }) })
      const data = await res.json()
      if (!data.success) { setError(data.error ?? 'Could not draft from that site.'); return }
      // Only fill fields that are still empty — never overwrite what you typed.
      const next = { ...f }
      for (const [k, v] of Object.entries(data.draft as Record<string, string | undefined>)) {
        if (v && !(next as Record<string, string>)[k]) (next as Record<string, string>)[k] = v
      }
      setF(next)
      setNote('Drafted from the website. Check every price, hour and policy before saving — the assistant will quote them to customers.')
    } finally { setBusy(null) }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy('save'); setError('')
    try {
      const res = await fetch('/api/admin/clients/onboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
      const data = await res.json()
      if (!data.success) { setError(data.error ?? 'Could not create the client.'); return }
      setResult(data)
    } finally { setBusy(null) }
  }

  if (result) {
    const chatPart = f.services === 'voice' ? '' : `1) Add this line to your website (before </body>, or in your site builder's "custom code" / "header" box):\n${result.snippet}\n\nNo website access? Share this chat link instead: ${result.hostedChatUrl}\n\n`
    const voicePart = f.services === 'chat' ? '' : `${f.services === 'both' ? '2' : '1'}) Your phone assistant: we'll send your phone number and how to forward your calls to it.\n\n`
    const welcome = `Hi! Your AI receptionist is set up.\n\n${chatPart}${voicePart}See your leads any time: ${result.login.url}\nEmail: ${result.login.email}\nTemporary password: ${result.login.password}\n\nReply if you'd like it connected to your CRM.`
    return (
      <div className="space-y-5 text-sm">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="font-medium">Client created: {result.businessId}</p>
          <p className="mt-1 text-xs text-muted-foreground">{result.servicesParsed} service(s) and {result.faqsParsed} FAQ(s) saved. Booking is off (leads only). Save the password now — it is shown once.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-2">
          <p className="font-medium">1. Website install line</p>
          <pre className="overflow-x-auto rounded-lg bg-secondary p-3 text-xs">{result.snippet}</pre>
          <Copy text={result.snippet} label="Copy snippet" />
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-1">
          <p className="font-medium">2. Client login</p>
          <p className="text-xs">{result.login.url}</p>
          <p className="text-xs">Email: {result.login.email}</p>
          <p className="text-xs">Password: <code>{result.login.password}</code></p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-1">
          <p className="font-medium">3. Payment</p>
          {result.checkoutUrl ? <><p className="break-all text-xs">{result.checkoutUrl}</p><Copy text={result.checkoutUrl} label="Copy checkout link" /></> : <p className="text-xs text-muted-foreground">Set FREEMIUS_CHECKOUT_URL in Vercel to show your checkout link here. The client must pay using <b>{result.login.email}</b> so the payment links to them automatically.</p>}
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-2">
          <p className="font-medium">Ready-to-send message</p>
          <pre className="whitespace-pre-wrap rounded-lg bg-secondary p-3 text-xs">{welcome}</pre>
          <Copy text={welcome} label="Copy message" />
        </div>
        <Button size="sm" variant="outline" onClick={() => { setResult(null); setF(empty) }}>Onboard another client</Button>
      </div>
    )
  }

  return (
    <form onSubmit={save} className="space-y-6 text-sm">
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <p className="font-medium">1. The business</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5"><span className="font-medium">Business name *</span><input required className={input} value={f.name} onChange={set('name')} /></label>
          <label className="space-y-1.5"><span className="font-medium">Industry *</span><input required className={input} placeholder="Dentist, HVAC, Law firm…" value={f.industry} onChange={set('industry')} /></label>
          <label className="space-y-1.5 sm:col-span-2"><span className="font-medium">Website</span>
            <div className="flex gap-2"><input className={input} placeholder="https://…" value={f.website} onChange={set('website')} />
              <Button type="button" variant="outline" size="sm" disabled={!f.website || busy !== null} onClick={draft}>{busy === 'draft' ? 'Reading…' : 'Draft from website'}</Button></div></label>
          <label className="space-y-1.5"><span className="font-medium">Phone</span><input className={input} value={f.phone} onChange={set('phone')} /></label>
          <label className="space-y-1.5"><span className="font-medium">Address</span><input className={input} value={f.address} onChange={set('address')} /></label>
          <label className="space-y-1.5"><span className="font-medium">Timezone</span><input className={input} value={f.timezone} onChange={set('timezone')} /></label>
          <label className="space-y-1.5"><span className="font-medium">What did they buy?</span>
            <select className={input} value={f.services} onChange={set('services')}><option value="chat">Website chat</option><option value="voice">Phone assistant</option><option value="both">Both</option></select></label>
          <label className="space-y-1.5"><span className="font-medium">Assistant name</span><input className={input} value={f.assistantName} onChange={set('assistantName')} /></label>
        </div>
        {note ? <p className="text-xs text-primary">{note}</p> : null}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <p className="font-medium">2. What the assistant knows</p>
        <label className="space-y-1.5 block"><span className="font-medium">Opening hours <span className="font-normal text-muted-foreground">(one rule per line; empty = Mon–Fri 9–5)</span></span>
          <textarea className={input + ' min-h-20 font-mono text-xs'} placeholder={'Mon-Fri 9am-5pm\nSat 10am-2pm\nSun closed'} value={f.hoursText} onChange={set('hoursText')} /></label>
        <label className="space-y-1.5 block"><span className="font-medium">Services <span className="font-normal text-muted-foreground">(Name | price | minutes | description)</span></span>
          <textarea className={input + ' min-h-24 font-mono text-xs'} placeholder={'Cleaning | $120 | 45 | Standard cleaning and exam'} value={f.servicesText} onChange={set('servicesText')} /></label>
        <label className="space-y-1.5 block"><span className="font-medium">FAQs <span className="font-normal text-muted-foreground">(Question | Answer)</span></span>
          <textarea className={input + ' min-h-24 font-mono text-xs'} placeholder={'Do you take insurance? | Yes, most PPO plans.'} value={f.faqsText} onChange={set('faqsText')} /></label>
        <label className="space-y-1.5 block"><span className="font-medium">Policies <span className="font-normal text-muted-foreground">(one per line)</span></span>
          <textarea className={input + ' min-h-16 font-mono text-xs'} placeholder={'24-hour cancellation notice.'} value={f.policiesText} onChange={set('policiesText')} /></label>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <p className="font-medium">3. Where leads go</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5"><span className="font-medium">Lead alert email *</span><input required type="email" className={input} value={f.notifyEmail} onChange={set('notifyEmail')} /></label>
          <label className="space-y-1.5"><span className="font-medium">Client login email <span className="font-normal text-muted-foreground">(defaults to the alert email; must match their payment email)</span></span><input type="email" className={input} value={f.clientEmail} onChange={set('clientEmail')} /></label>
          <label className="space-y-1.5 sm:col-span-2"><span className="font-medium">CRM / automation webhook URL <span className="font-normal text-muted-foreground">(optional — Zapier, Make, n8n, HubSpot…)</span></span><input className={input} placeholder="https://hooks.zapier.com/…" value={f.webhookUrl} onChange={set('webhookUrl')} /></label>
          <label className="space-y-1.5 sm:col-span-2"><span className="font-medium">Google Sheet ID <span className="font-normal text-muted-foreground">(optional — the dashboard already lists every lead with a CSV download)</span></span><input className={input} value={f.leadSheetId} onChange={set('leadSheetId')} /></label>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={busy !== null}>{busy === 'save' ? 'Creating…' : 'Create client'}</Button>
    </form>
  )
}
