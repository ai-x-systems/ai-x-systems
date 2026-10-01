'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

const input = 'w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm outline-none focus-visible:border-ring'

export function VoiceLineForm({ businessIds }: { businessIds: string[] }) {
  const router = useRouter()
  const [f, setF] = useState({ businessId: businessIds[0] ?? '', number: '', forwardTo: '', vapiPhoneNumberId: '', sellCentsPerMinute: '30' })
  const [msg, setMsg] = useState('')
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })

  async function save(e: React.FormEvent) {
    e.preventDefault(); setMsg('')
    const res = await fetch('/api/admin/voice/lines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, sellCentsPerMinute: Number(f.sellCentsPerMinute) }) })
    const data = await res.json()
    setMsg(data.success ? 'Saved.' : data.error ?? 'Failed')
    if (data.success) router.refresh()
  }

  return (
    <form onSubmit={save} className="space-y-4 text-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5"><span className="font-medium">Client</span>
          <select className={input} value={f.businessId} onChange={set('businessId')}>{businessIds.map((id) => <option key={id} value={id}>{id}</option>)}</select></label>
        <label className="space-y-1.5"><span className="font-medium">Phone number callers reach *</span>
          <input required className={input} placeholder="+15125550123" value={f.number} onChange={set('number')} /></label>
        <label className="space-y-1.5"><span className="font-medium">Fallback number <span className="font-normal text-muted-foreground">(a human; used when minutes run out)</span></span>
          <input className={input} placeholder="+15125550199" value={f.forwardTo} onChange={set('forwardTo')} /></label>
        <label className="space-y-1.5"><span className="font-medium">You charge (cents per minute) <span className="font-normal text-muted-foreground">(margin report only)</span></span>
          <input className={input} type="number" min={0} value={f.sellCentsPerMinute} onChange={set('sellCentsPerMinute')} /></label>
        <label className="space-y-1.5 sm:col-span-2"><span className="font-medium">Vapi phone number id <span className="font-normal text-muted-foreground">(optional backup match)</span></span>
          <input className={input} value={f.vapiPhoneNumberId} onChange={set('vapiPhoneNumberId')} /></label>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm">Save line</Button>
        {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
      </div>
    </form>
  )
}
