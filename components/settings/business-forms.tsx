'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'
import { VOICES } from '@/lib/voice/voices'
import { defaultChatGreeting, defaultPhoneGreeting } from '@/lib/config/greetings'

/**
 * The forms for "my assistant" and "my business". The same forms serve the client's dashboard and the
 * admin's manage page: only the endpoint differs, and the server applies the same rules to both.
 */
const field = 'mt-1 w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm'
const DISCLOSURE = /\b(virtual|automated|digital)\s+(assistant|receptionist)\b|\bAI\b/i

function useSave(endpoint: string) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(body: Record<string, unknown>, okText: string) {
    setBusy(true); setError('')
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) { setError(data.error || 'Could not save.'); toast(data.error || 'Could not save.', 'error'); return false }
      toast(okText); router.refresh(); return true
    } catch {
      setError('Could not reach the server.'); toast('Could not reach the server.', 'error'); return false
    } finally { setBusy(false) }
  }
  return { busy, error, save }
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <p className="text-sm font-medium">{title}</p>
      {hint ? <p className="mb-4 mt-1 text-xs text-muted-foreground">{hint}</p> : <div className="mb-4" />}
      {children}
    </section>
  )
}

const TONES = [
  { id: 'friendly', label: 'Friendly', text: 'Relaxed and welcoming' },
  { id: 'professional', label: 'Professional', text: 'Polished and businesslike' },
  { id: 'warm', label: 'Warm', text: 'Caring and personal' },
  { id: 'concise', label: 'Concise', text: 'Short and to the point' },
]

export function AssistantForm({
  endpoint, businessName, initial,
}: {
  endpoint: string
  businessName: string
  /** greeting is '' when it simply follows the name (the default). */
  initial: { assistantName: string; tone: string; greeting: string; voiceId: string }
}) {
  const [name, setName] = useState(initial.assistantName)
  const [tone, setTone] = useState(initial.tone)
  const [greeting, setGreeting] = useState(initial.greeting)
  const [voiceId, setVoiceId] = useState(initial.voiceId)
  const { busy, error, save } = useSave(endpoint)

  const shownName = name.trim() || 'your assistant'
  const phonePreview = greeting.trim() || defaultPhoneGreeting(businessName, shownName)
  const needsDisclosure = greeting.trim().length > 0 && !DISCLOSURE.test(greeting)

  return (
    <div className="space-y-6">
      <Section title="Name" hint="This is the name callers and website visitors hear. Pick anything friendly.">
        <label className="block text-xs text-muted-foreground">Assistant name
          <input className={field} value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="Ava" />
        </label>
      </Section>

      <Section title="Phone voice" hint="Used when your assistant answers calls. You can change it any time.">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${voiceId === '' ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/40'}`}>
            <input type="radio" name="voice" className="mt-1" checked={voiceId === ''} onChange={() => setVoiceId('')} />
            <span><span className="block text-sm font-medium">Standard voice</span><span className="text-xs text-muted-foreground">Male · Canadian · natural, calm (our default)</span></span>
          </label>
          {VOICES.filter((v) => v.id !== 'Elliot').map((v) => (
            <label key={v.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${voiceId === v.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/40'}`}>
              <input type="radio" name="voice" className="mt-1" checked={voiceId === v.id} onChange={() => setVoiceId(v.id)} />
              <span><span className="block text-sm font-medium">{v.label}</span><span className="text-xs text-muted-foreground">{v.gender} · {v.accent} · {v.feel}</span></span>
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Make a test call after changing the voice to hear it.</p>
      </Section>

      <Section title="Personality" hint="How your assistant talks, in chat and on the phone.">
        <div className="grid gap-2 sm:grid-cols-2">
          {TONES.map((t) => (
            <label key={t.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${tone === t.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/40'}`}>
              <input type="radio" name="tone" className="mt-1" checked={tone === t.id} onChange={() => setTone(t.id)} />
              <span><span className="block text-sm font-medium">{t.label}</span><span className="text-xs text-muted-foreground">{t.text}</span></span>
            </label>
          ))}
        </div>
      </Section>

      <Section title="How it answers the phone" hint="Leave this empty to use the standard greeting with your assistant's name. A custom greeting must tell callers they are speaking to a virtual assistant.">
        <textarea className={`${field} min-h-[88px]`} value={greeting} maxLength={400} onChange={(e) => setGreeting(e.target.value)} placeholder={defaultPhoneGreeting(businessName, shownName)} />
        {needsDisclosure ? <p className="mt-2 text-xs text-destructive">Add words like &quot;virtual assistant&quot; so callers know they are not speaking to a person.</p> : null}
        <div className="mt-4 space-y-2 rounded-xl bg-muted/30 p-4 text-sm">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Preview</p>
          <p><span className="text-muted-foreground">On the phone: </span>&ldquo;{phonePreview}&rdquo;</p>
          <p><span className="text-muted-foreground">In chat: </span>&ldquo;{defaultChatGreeting(businessName, shownName)}&rdquo;</p>
        </div>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy || !name.trim() || needsDisclosure} className="btn btn-primary" onClick={() => save({ action: 'assistant', assistantName: name, tone, greeting, voiceId }, 'Assistant updated')}>
          {busy ? 'Saving…' : 'Save assistant'}
        </button>
        {error ? <span className="text-xs text-destructive">{error}</span> : <span className="text-xs text-muted-foreground">Changes apply within about a minute.</span>}
      </div>
    </div>
  )
}

export function DetailsForm({ endpoint, initial }: { endpoint: string; initial: { name: string; phone: string; address: string; website: string } }) {
  const [v, setV] = useState(initial)
  const { busy, error, save } = useSave(endpoint)
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value })
  return (
    <Section title="Business details" hint="Used in what the assistant says about you.">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">Business name<input className={field} value={v.name} onChange={set('name')} /></label>
        <label className="text-xs text-muted-foreground">Phone number customers know you by<input className={field} value={v.phone} onChange={set('phone')} /></label>
        <label className="text-xs text-muted-foreground">Address<input className={field} value={v.address} onChange={set('address')} /></label>
        <label className="text-xs text-muted-foreground">Website<input className={field} value={v.website} onChange={set('website')} /></label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" disabled={busy || !v.name.trim()} className="btn btn-primary btn-sm" onClick={() => save({ action: 'profile', ...v }, 'Details saved')}>{busy ? 'Saving…' : 'Save details'}</button>
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
      </div>
    </Section>
  )
}

const ZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
  'America/Toronto', 'America/Vancouver', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Australia/Sydney',
]

export function HoursForm({ endpoint, initial, unknown = false }: { endpoint: string; initial: { hoursText: string; timezone: string }; unknown?: boolean }) {
  const [text, setText] = useState(initial.hoursText)
  const [tz, setTz] = useState(initial.timezone)
  const { busy, error, save } = useSave(endpoint)
  const zones = ZONES.includes(tz) ? ZONES : [tz, ...ZONES]
  return (
    <Section title="Opening hours" hint="One line per day range. Anything you don't list is treated as closed.">
      {unknown ? <p className="mb-3 rounded-lg bg-amber-400/10 p-3 text-xs text-amber-300">Your opening hours aren&apos;t set yet, so your assistant doesn&apos;t quote any. Save them below.</p> : null}
      <textarea className={`${field} min-h-[132px] font-mono`} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Mon-Fri 9am-5pm\nSat 10am-2pm\nSun closed'} />
      <label className="mt-3 block text-xs text-muted-foreground">Timezone
        <select className={field} value={tz} onChange={(e) => setTz(e.target.value)}>{zones.map((z) => <option key={z} value={z}>{z.replace('_', ' ')}</option>)}</select>
      </label>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" disabled={busy || !text.trim()} className="btn btn-primary btn-sm" onClick={() => save({ action: 'hours', hoursText: text, timezone: tz }, 'Opening hours saved')}>{busy ? 'Saving…' : 'Save hours'}</button>
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
      </div>
    </Section>
  )
}

export function ServicesForm({ endpoint, initial, locked = false }: { endpoint: string; initial: { servicesText: string }; locked?: boolean }) {
  const [text, setText] = useState(initial.servicesText)
  const { busy, error, save } = useSave(endpoint)
  return (
    <Section title="Services &amp; prices" hint="One service per line: Name | price | minutes | short description. Everything after the name is optional.">
      {locked ? <p className="mb-3 rounded-lg bg-amber-400/10 p-3 text-xs text-amber-300">Online booking is switched on for your business and is tied to these services, so we change them for you. Use the change request on the &quot;What it knows&quot; page.</p> : null}
      <textarea className={`${field} min-h-[168px] font-mono`} disabled={locked} value={text} onChange={(e) => setText(e.target.value)} placeholder={'AC repair | From $89 | 60 | Diagnosis and repair\nFull tune-up | $129 | 45'} />
      <div className="mt-4 flex items-center gap-3">
        <button type="button" disabled={busy || locked} className="btn btn-primary btn-sm" onClick={() => save({ action: 'services', servicesText: text }, 'Services saved')}>{busy ? 'Saving…' : 'Save services'}</button>
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
      </div>
    </Section>
  )
}
