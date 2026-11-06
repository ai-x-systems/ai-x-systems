'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'

export type RequestView = { status: 'pending' | 'done' | 'declined'; createdAtISO: string } | null

const field = 'mt-1 w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm'
const PLATFORMS = ['WordPress', 'Wix', 'Squarespace', 'Shopify', 'Webflow', 'GoDaddy', 'Other / not sure']
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

function useSend(kind: 'phone' | 'chat_install') {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function send(body: Record<string, unknown>) {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/client/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, ...body }) })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) { setError(data.error || 'Could not send your request.'); toast(data.error || 'Could not send your request.', 'error'); return }
      toast('Request sent. We will be in touch.')
      router.refresh()
    } catch { setError('Could not reach the server.') } finally { setBusy(false) }
  }
  return { busy, error, send }
}

function Pending({ latest, what }: { latest: NonNullable<RequestView>; what: string }) {
  return (
    <div className="card stat p-5">
      <p className="flex items-center gap-2 text-sm font-medium"><span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />Request received</p>
      <p className="mt-1 text-sm text-muted-foreground">You asked us to set up {what} on {day(latest.createdAtISO)}. We will do it and email you as soon as it&apos;s ready. It will then appear on this page.</p>
    </div>
  )
}

export function PhoneRequestCard({ latest, hasLine = false }: { latest: RequestView; hasLine?: boolean }) {
  const { busy, error, send } = useSend('phone')
  const [mode, setMode] = useState<'new' | 'keep'>('new')
  const [areaCode, setAreaCode] = useState('')
  const [current, setCurrent] = useState('')
  const [note, setNote] = useState('')
  const [consent, setConsent] = useState(false)
  if (latest?.status === 'pending') return <Pending latest={latest} what="your phone number" />

  return (
    <div className="card p-5">
      <p className="text-sm font-medium">{hasLine ? 'Need a different number?' : 'Get your AI phone number'}</p>
      <p className="mt-1 text-xs text-muted-foreground">Tell us what you want and give us permission to set it up. We create the number, connect it to your assistant and show it here.</p>
      {latest?.status === 'declined' ? <p className="mt-2 text-xs text-destructive">Your last request couldn&apos;t be completed. Send a new one or contact us.</p> : null}
      <div className="mt-4 space-y-3">
        <fieldset className="space-y-2 text-sm">
          <label className="flex items-start gap-2"><input type="radio" className="mt-1" checked={mode === 'new'} onChange={() => setMode('new')} /><span><span className="font-medium">A new number for my assistant</span><span className="block text-xs text-muted-foreground">Best for a number you put on your website and Google listing.</span></span></label>
          <label className="flex items-start gap-2"><input type="radio" className="mt-1" checked={mode === 'keep'} onChange={() => setMode('keep')} /><span><span className="font-medium">I keep my current number and forward calls to the assistant</span><span className="block text-xs text-muted-foreground">We give you a number and the forwarding steps. Your current number stays yours.</span></span></label>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">Preferred area code (optional)<input className={field} inputMode="numeric" maxLength={3} value={areaCode} onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, ''))} placeholder="512" /></label>
          <label className="text-xs text-muted-foreground">{mode === 'keep' ? 'Your current business number' : 'Your current business number (optional)'}<input className={field} value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="+1 512 555 0123" /></label>
        </div>
        <label className="block text-xs text-muted-foreground">Anything we should know? (optional)<input className={field} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <label className="flex items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />I give AI x Systems permission to set up and connect a phone number for my business.</label>
        <div className="flex items-center gap-3">
          <button type="button" className="btn btn-primary btn-sm" disabled={busy || !consent || (mode === 'keep' && !current.trim())} onClick={() => send({ mode, areaCode, currentNumber: current, note, consent })}>{busy ? 'Sending…' : 'Request my number'}</button>
          {error ? <span className="text-xs text-destructive">{error}</span> : null}
        </div>
      </div>
    </div>
  )
}

export function ChatInstallCard({ latest, defaultWebsite = '' }: { latest: RequestView; defaultWebsite?: string }) {
  const { busy, error, send } = useSend('chat_install')
  const [website, setWebsite] = useState(defaultWebsite)
  const [platform, setPlatform] = useState(PLATFORMS[0])
  const [note, setNote] = useState('')
  const [consent, setConsent] = useState(false)
  if (latest?.status === 'pending') return <Pending latest={latest} what="the chat on your website" />

  return (
    <div className="card p-5">
      <p className="text-sm font-medium">Want us to install it for you?</p>
      <p className="mt-1 text-xs text-muted-foreground">Prefer not to touch your website? Tell us where it lives and give us permission. We will add the chat for you. Please never send us your password: if we need access we will ask you to invite us as a user.</p>
      {latest?.status === 'done' ? <p className="mt-2 text-xs text-primary">Your last install request was completed on {day(latest.createdAtISO)}.</p> : null}
      <div className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">Your website<input className={field} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="www.yourbusiness.com" /></label>
          <label className="text-xs text-muted-foreground">Built with<select className={field} value={platform} onChange={(e) => setPlatform(e.target.value)}>{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select></label>
        </div>
        <label className="block text-xs text-muted-foreground">Notes (optional)<input className={field} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. my web developer is Sam, sam@example.com" /></label>
        <label className="flex items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />I give AI x Systems permission to add the chat widget to my website.</label>
        <div className="flex items-center gap-3">
          <button type="button" className="btn btn-primary btn-sm" disabled={busy || !consent || !website.trim()} onClick={() => send({ websiteUrl: website, platform, note, consent })}>{busy ? 'Sending…' : 'Ask you to install it'}</button>
          {error ? <span className="text-xs text-destructive">{error}</span> : null}
        </div>
      </div>
    </div>
  )
}
