'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'

export type PanelRequest = { id: string; kind: 'phone' | 'chat_install'; businessId: string; businessName: string; email: string | null; status: 'pending' | 'done' | 'declined'; details: Record<string, unknown>; createdAtISO: string }

const LABEL = { phone: 'Phone number request', chat_install: 'Chat install request' } as const

function summary(r: PanelRequest): string {
  const d = r.details
  if (r.kind === 'phone') return [d.mode === 'keep' ? 'keeps current number and forwards' : 'wants a new number', d.areaCode ? `area code ${d.areaCode}` : '', d.currentNumber ? `current: ${d.currentNumber}` : '', d.note].filter(Boolean).join(' · ')
  return [d.websiteUrl, d.platform, d.note].filter(Boolean).join(' · ')
}

/** Open requests from clients, with one-click "done" / "decline". Clients gave permission by ticking the box on their form. */
export function RequestsPanel({ requests, title = 'Client requests' }: { requests: PanelRequest[]; title?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState('')
  if (requests.length === 0) return null

  async function set(id: string, status: 'done' | 'declined') {
    setBusy(id)
    try {
      const res = await fetch('/api/admin/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
      if (!res.ok) { toast('Could not update the request.', 'error'); return }
      toast(status === 'done' ? 'Marked as done' : 'Request declined')
      router.refresh()
    } finally { setBusy('') }
  }

  return (
    <div className="card border-amber-400/40 p-5">
      <p className="flex items-center gap-2 text-sm font-medium"><span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />{title} ({requests.length})</p>
      <ul className="mt-3 divide-y divide-border">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">{LABEL[r.kind]} <span className="font-normal text-muted-foreground">· {r.businessName} · {new Date(r.createdAtISO).toLocaleDateString()}</span></p>
              <p className="mt-0.5 break-words text-xs text-muted-foreground">{summary(r)}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Permission given by the client when they sent it.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/admin/clients/${r.businessId}/edit#${r.kind === 'phone' ? 'phone' : 'chatcode'}`} className="btn btn-primary btn-xs">Open</Link>
              <button type="button" disabled={busy === r.id} onClick={() => set(r.id, 'done')} className="btn btn-outline btn-xs">Mark done</button>
              <button type="button" disabled={busy === r.id} onClick={() => set(r.id, 'declined')} className="btn btn-ghost btn-xs text-muted-foreground">Decline</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
