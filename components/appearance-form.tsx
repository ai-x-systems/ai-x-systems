'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { resolveBrand } from '@/lib/config/brand'

const input = 'w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm outline-none focus-visible:border-ring'

export interface AppearanceInitial {
  greeting?: string; bubble?: string; headline?: string; subtitle?: string; suggestions?: string[]; brandColor?: string
}
export interface AppearanceDefaults { greeting: string; bubble: string; headline: string; subtitle: string; suggestions: string[] }

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || 'AI'

/**
 * Lets an owner (or you, for a client) change how the chat looks and sounds. Blank = the default.
 * The preview uses the same colour logic as the real widget, so what you see is what visitors get.
 */
export function AppearanceForm({ endpoint, businessName, initial, defaults }: { endpoint: string; businessName: string; initial: AppearanceInitial; defaults: AppearanceDefaults }) {
  const [f, setF] = useState({
    brandColor: initial.brandColor ?? '',
    headline: initial.headline ?? '',
    subtitle: initial.subtitle ?? '',
    greeting: initial.greeting ?? '',
    bubble: initial.bubble ?? '',
    suggestions: (initial.suggestions ?? []).join('\n'),
  })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  const brand = resolveBrand({ chat: { brandColor: f.brandColor } })
  const gradient = `linear-gradient(135deg, ${brand.from} 0%, ${brand.to} 100%)`
  const chips = (f.suggestions.split('\n').map((s) => s.trim()).filter(Boolean).length ? f.suggestions.split('\n').map((s) => s.trim()).filter(Boolean) : defaults.suggestions).slice(0, 4)
  const colorValid = /^(#([0-9a-f]{3}|[0-9a-f]{6})|[0-9a-f]{6})$/i.test(f.brandColor.trim())

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('')
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
      const data = await res.json().catch(() => ({}))
      setMsg(data.success ? 'Saved. Your website chat updates within a minute.' : data.error ?? 'Could not save.')
    } finally { setBusy(false) }
  }

  return (
    <form onSubmit={save} className="grid gap-6 text-sm md:grid-cols-2">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <span className="font-medium">Brand colour</span>
          <div className="flex items-center gap-3">
            <input type="color" aria-label="Pick a colour" value={colorValid ? (f.brandColor.startsWith('#') ? f.brandColor : '#' + f.brandColor) : '#4f46e5'} onChange={(e) => setF({ ...f, brandColor: e.target.value })} className="h-10 w-14 cursor-pointer rounded border border-input bg-transparent p-1" />
            <input className={input} placeholder="#c8102e (empty = default blue)" value={f.brandColor} onChange={set('brandColor')} />
          </div>
          {f.brandColor && !colorValid ? <p className="text-xs text-destructive">Use a colour like #c8102e.</p> : <p className="text-xs text-muted-foreground">Very light colours are darkened a little so the white text stays readable.</p>}
        </div>
        <label className="block space-y-1.5"><span className="font-medium">Headline</span><input className={input} maxLength={80} placeholder={defaults.headline} value={f.headline} onChange={set('headline')} /></label>
        <label className="block space-y-1.5"><span className="font-medium">Line under the headline</span><input className={input} maxLength={160} placeholder={defaults.subtitle} value={f.subtitle} onChange={set('subtitle')} /></label>
        <label className="block space-y-1.5"><span className="font-medium">First message</span><textarea className={input + ' min-h-20'} maxLength={400} placeholder={defaults.greeting} value={f.greeting} onChange={set('greeting')} /></label>
        <label className="block space-y-1.5"><span className="font-medium">Pop-up beside the chat button</span><input className={input} maxLength={160} placeholder={defaults.bubble} value={f.bubble} onChange={set('bubble')} /></label>
        <label className="block space-y-1.5"><span className="font-medium">Quick questions <span className="font-normal text-muted-foreground">(one per line, up to 4; empty = defaults)</span></span><textarea className={input + ' min-h-20'} placeholder={defaults.suggestions.join('\n')} value={f.suggestions} onChange={set('suggestions')} /></label>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={busy || (!!f.brandColor && !colorValid)}>{busy ? 'Saving…' : 'Save appearance'}</Button>
          {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs text-muted-foreground">Live preview</p>
        <div className="overflow-hidden rounded-2xl border border-border shadow-lg" style={{ background: '#fff', color: '#111827', maxWidth: 360 }}>
          <div style={{ background: gradient, color: '#fff', padding: '14px 18px', fontWeight: 600, fontSize: 15 }}>{businessName}</div>
          <div style={{ padding: '16px 14px' }}>
            <div style={{ textAlign: 'center', paddingBottom: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: gradient, color: '#fff', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{initialsOf(businessName)}</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{f.headline.trim() || defaults.headline}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, lineHeight: 1.45 }}>{f.subtitle.trim() || defaults.subtitle}</div>
            </div>
            <div style={{ display: 'inline-block', background: '#f3f4f6', borderRadius: '14px 14px 14px 4px', padding: '9px 13px', fontSize: 13, lineHeight: 1.45, maxWidth: '85%' }}>{f.greeting.trim() || defaults.greeting}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0 4px' }}>
              {chips.map((q) => <span key={q} style={{ border: `1px solid ${brand.from}`, color: brand.from, borderRadius: 999, padding: '5px 11px', fontSize: 12 }}>{q}</span>)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <div style={{ background: gradient, color: '#fff', borderRadius: '14px 14px 4px 14px', padding: '9px 13px', fontSize: 13 }}>Hi, do you have availability this week?</div>
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
