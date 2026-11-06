'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'
import { CopyField } from '@/components/copy-field'
import { DeleteButton } from '@/components/delete-button'

type Props = {
  businessId: string
  hasLine: boolean
  initial: { number: string; forwardTo: string; vapiPhoneNumberId: string; sellCentsPerMinute: string }
  vapiReady: boolean
  serverUrl: string | null
}

const field = 'mt-1 w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm'

/** Attach a phone number to this client, and (with VAPI_API_KEY set) point it at your webhook in Vapi with one click. */
export function ClientLineForm({ businessId, hasLine, initial, vapiReady, serverUrl }: Props) {
  const router = useRouter()
  const [f, setF] = useState(initial)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  async function save() {
    setBusy('save'); setMsg(null)
    try {
      const res = await fetch('/api/admin/voice/lines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessId, number: f.number, forwardTo: f.forwardTo, vapiPhoneNumberId: f.vapiPhoneNumberId, sellCentsPerMinute: Number(f.sellCentsPerMinute) }) })
      const data = (await res.json().catch(() => ({}))) as { error?: string; vapi?: { connected?: boolean; error?: string; warning?: string } }
      if (!res.ok) { setMsg({ ok: false, text: data.error || 'Could not save.' }); toast(data.error || 'Could not save.', 'error'); return }
      const v = data.vapi
      const text = v ? (v.connected ? `Saved and connected in Vapi.${v.warning ? ' ' + v.warning : ''}` : `Saved, but Vapi said: ${v.error}`) : 'Saved.'
      setMsg({ ok: !v || !!v.connected, text }); toast(v?.connected ? 'Line saved and connected in Vapi' : 'Line saved')
      router.refresh()
    } finally { setBusy('') }
  }

  async function connect() {
    setBusy('connect'); setMsg(null)
    try {
      const res = await fetch('/api/admin/voice/vapi-connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessId }) })
      const data = (await res.json().catch(() => ({}))) as { error?: string; warning?: string }
      if (!res.ok) { setMsg({ ok: false, text: data.error || 'Vapi did not accept that.' }); toast(data.error || 'Vapi did not accept that.', 'error'); return }
      setMsg({ ok: true, text: `Connected: Vapi now sends this number's calls to your system.${data.warning ? ' ' + data.warning : ''}` }); toast('Connected in Vapi')
    } finally { setBusy('') }
  }

  return (
    <div className="card p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">Phone number callers reach<input className={field} value={f.number} onChange={set('number')} placeholder="+15125550123" /></label>
        <label className="text-xs text-muted-foreground">Vapi phone number id<input className={field} value={f.vapiPhoneNumberId} onChange={set('vapiPhoneNumberId')} placeholder="from the number's page in Vapi" /></label>
        <label className="text-xs text-muted-foreground">Fallback number (their own phone; used when minutes run out)<input className={field} value={f.forwardTo} onChange={set('forwardTo')} placeholder="+15125550199" /></label>
        <label className="text-xs text-muted-foreground">You charge (cents per minute, margin report only)<input className={field} type="number" min={0} value={f.sellCentsPerMinute} onChange={set('sellCentsPerMinute')} /></label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary btn-sm" disabled={!!busy || !f.number.trim()} onClick={save}>{busy === 'save' ? 'Saving…' : hasLine ? 'Save line' : 'Attach line'}</button>
        {hasLine && vapiReady ? <button type="button" className="btn btn-outline btn-sm" disabled={!!busy || !f.vapiPhoneNumberId.trim()} onClick={connect}>{busy === 'connect' ? 'Connecting…' : 'Connect in Vapi'}</button> : null}
        {hasLine ? <DeleteButton endpoint={`/api/admin/voice/lines?businessId=${encodeURIComponent(businessId)}`} label="Remove line" warning="Callers to this number will no longer be answered. The client keeps their account and minutes." /> : null}
      </div>
      {msg ? <p className={`mt-3 text-xs ${msg.ok ? 'text-primary' : 'text-destructive'}`}>{msg.text}</p> : null}

      <div className="mt-5 rounded-lg border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">{vapiReady ? 'Vapi is connected to this dashboard' : 'Doing it by hand in Vapi (or add VAPI_API_KEY in Vercel to automate this)'}</p>
        {vapiReady ? (
          <p className="mt-1">Buy or import the number in Vapi, paste its number and id above and click Attach line: your system points the number at itself automatically. Leave the number&apos;s Assistant field empty in Vapi.</p>
        ) : (
          <>
            <p className="mt-1">In Vapi → Phone Numbers → this number: leave <strong>Assistant</strong> empty and set <strong>Server URL</strong> to the address below. Then paste the number and its id above. To skip this step next time, add your Vapi <strong>private</strong> API key to Vercel as <code>VAPI_API_KEY</code>.</p>
            {serverUrl ? <div className="mt-2"><CopyField value={serverUrl} /><p className="mt-1">This address contains your secret. Don&apos;t share it.</p></div> : <p className="mt-2 text-destructive">VOICE_WEBHOOK_SECRET isn&apos;t set in Vercel.</p>}
          </>
        )}
      </div>
    </div>
  )
}
