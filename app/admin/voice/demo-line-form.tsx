'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

const input = 'w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm outline-none focus-visible:border-ring'

export function DemoLineForm({ previewIds, hasLine }: { previewIds: string[]; hasLine: boolean }) {
  const router = useRouter()
  const [businessId, setBusinessId] = useState(previewIds[0] ?? '')
  const [number, setNumber] = useState('')
  const [msg, setMsg] = useState('')

  async function save(e: React.FormEvent) {
    e.preventDefault(); setMsg('')
    const res = await fetch('/api/admin/voice/demo-line', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessId, number }) })
    const data = await res.json()
    setMsg(data.success ? 'Saved.' : data.error ?? 'Failed')
    if (data.success) router.refresh()
  }

  if (previewIds.length === 0) return <p className="text-xs text-muted-foreground">No previews yet. Create one from Onboard → Create preview, or wait for the daily run.</p>
  return (
    <form onSubmit={save} className="space-y-3 text-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5"><span className="font-medium">Point the demo line at</span>
          <select className={input} value={businessId} onChange={(e) => setBusinessId(e.target.value)}>{previewIds.map((id) => <option key={id} value={id}>{id}</option>)}</select></label>
        {!hasLine ? (
          <label className="space-y-1.5"><span className="font-medium">Demo line phone number *</span>
            <input required className={input} placeholder="+15125550123" value={number} onChange={(e) => setNumber(e.target.value)} /></label>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm">{hasLine ? 'Move demo line' : 'Create demo line'}</Button>
        {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
      </div>
    </form>
  )
}
