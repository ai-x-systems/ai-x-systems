'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Initial = { notifyEmail: string; webhookUrl: string; leadSheet: string; leadSheetTabName: string }

const input = 'mt-1 w-full rounded-md border border-input bg-input/30 px-3 py-2 text-sm'
const btn = 'rounded-md border border-input px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-60'

export function IntegrationsForm({ initial, serviceEmail }: { initial: Initial; serviceEmail?: string }) {
  const router = useRouter()
  const [v, setV] = useState(initial)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState<{ key: string; ok: boolean; text: string } | null>(null)
  const set = (k: keyof Initial) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value })

  async function call(action: string, key: string, okText: string) {
    setBusy(key); setMsg(null)
    try {
      const res = await fetch('/api/client/integrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...v }) })
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
      setMsg({ key, ok: res.ok && data.success !== false, text: res.ok ? okText : data.error || 'Something went wrong.' })
      return res.ok
    } finally { setBusy('') }
  }
  const save = async () => { if (await call('save', 'save', 'Saved.')) router.refresh() }
  const test = async (action: 'test_webhook' | 'test_sheet', key: string, okText: string) => {
    if (await call('save', key, '')) await call(action, key, okText)
  }
  const note = (key: string) => (msg?.key === key && msg.text ? <span className={`text-xs ${msg.ok ? 'text-primary' : 'text-destructive'}`}>{msg.text}</span> : null)

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-medium">Email alerts</p>
        <p className="mt-1 text-xs text-muted-foreground">Every new lead and booking is emailed here.</p>
        <label className="mt-3 block text-xs text-muted-foreground">Alert email
          <input className={input} type="email" value={v.notifyEmail} onChange={set('notifyEmail')} />
        </label>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-medium">CRM or automation (Zapier, Make, n8n, HubSpot, GoHighLevel…)</p>
        <p className="mt-1 text-xs text-muted-foreground">
          In your tool, create a trigger of type <strong>Webhook</strong> (Zapier: &quot;Catch Hook&quot;; Make: &quot;Custom webhook&quot;), copy the address it gives you, and paste it here. Each new lead and booking is sent to it instantly.
        </p>
        <label className="mt-3 block text-xs text-muted-foreground">Webhook address (https)
          <input className={input} value={v.webhookUrl} onChange={set('webhookUrl')} placeholder="https://hooks.zapier.com/hooks/catch/…" />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" className={btn} disabled={!!busy || !v.webhookUrl} onClick={() => test('test_webhook', 'wh', 'Test lead sent. Check your tool.')}>{busy === 'wh' ? 'Sending…' : 'Send a test lead'}</button>
          {note('wh')}
        </div>
        <details className="mt-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer">What the message looks like</summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-secondary p-3">{`{
  "event": "lead",            // or "booking", "test"
  "businessId": "your-id",
  "timestampISO": "2026-11-01T15:04:05Z",
  "data": {
    "callerName": "Jane Doe",
    "callerEmail": "jane@example.com",
    "callerPhone": "+15125550123",
    "reason": "Wants a quote for a new AC unit"
  }
}`}</pre>
        </details>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-medium">Google Sheet</p>
        <p className="mt-1 text-xs text-muted-foreground">Every lead becomes a new row. Create a Google Sheet, click Share, and add <strong className="break-all text-foreground">{serviceEmail ?? 'our service address (ask us for it)'}</strong> as an <strong>Editor</strong>. Then paste the sheet&apos;s link here.</p>
        <label className="mt-3 block text-xs text-muted-foreground">Sheet link
          <input className={input} value={v.leadSheet} onChange={set('leadSheet')} placeholder="https://docs.google.com/spreadsheets/d/…" />
        </label>
        <label className="mt-3 block text-xs text-muted-foreground">Tab name (optional, default &quot;Sheet1&quot;)
          <input className={input} value={v.leadSheetTabName} onChange={set('leadSheetTabName')} placeholder="Sheet1" />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" className={btn} disabled={!!busy || !v.leadSheet} onClick={() => test('test_sheet', 'sh', 'Test row added. Open your sheet.')}>{busy === 'sh' ? 'Adding…' : 'Add a test row'}</button>
          {note('sh')}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={!!busy} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">{busy === 'save' ? 'Saving…' : 'Save changes'}</button>
        {note('save')}
      </div>
    </div>
  )
}
