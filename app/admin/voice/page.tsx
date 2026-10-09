import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAdminSession } from '@/lib/accounts/session'
import { AppTopbar } from '@/components/app-topbar'
import { PageHeader } from '@/components/page-header'
import { creditLedger } from '@/lib/billing/credits'
import { listStoredBusinesses } from '@/lib/config/business-store'
import { findDemoLine, listCalls, listLines } from '@/lib/voice/store'
import { VoiceLineForm } from './voice-line-form'
import { DemoLineForm } from './demo-line-form'

export const metadata = { title: 'Voice' }
export const dynamic = 'force-dynamic'

export default async function AdminVoicePage() {
  if (!(await getAdminSession())) redirect('/admin-login')

  const [lines, calls, businesses, demoLine] = await Promise.all([listLines(), listCalls(null, 200), listStoredBusinesses(), findDemoLine()])
  const previewIds = businesses.filter((b) => b.config.demo && b.config.id.startsWith('demo-')).map((b) => b.config.id)
  const balances = new Map<string, number>()
  for (const l of lines) balances.set(l.businessId, (await creditLedger.getBalance(l.businessId)).balance)

  const secretSet = !!process.env.VOICE_WEBHOOK_SECRET
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || 'https://<your-domain>').replace(/\/+$/, '')

  // Margin over the last 200 calls: what clients' minutes were worth to you vs what Vapi billed you.
  const sell = new Map(lines.map((l) => [l.businessId, l.sellCentsPerMinute]))
  const revenue = calls.reduce((s, c) => s + c.billedMinutes * (sell.get(c.businessId) ?? 0), 0)
  const cost = calls.reduce((s, c) => s + (c.vapiCostCents ?? 0), 0)
  const minutes = calls.reduce((s, c) => s + c.billedMinutes, 0)
  const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-16 md:px-6">
      <AppTopbar current="admin" />
      <div className="flex items-start justify-between gap-4">
        <PageHeader eyebrow="Admin" title="Voice" description="Phone lines, prepaid minutes and call history for every client." />
        <Link href="/admin" className="text-sm text-primary underline underline-offset-4">Back to Clients</Link>
      </div>

      <section className="mt-8 rounded-xl border border-border bg-card p-5 text-sm">
        <p className="font-medium">Webhook</p>
        <p className="mt-1 text-xs text-muted-foreground">
          In Vapi: each phone number → leave <b>Assistant</b> empty → Server URL:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-secondary p-3 text-xs">{`${origin}/api/voice/vapi?k=<VOICE_WEBHOOK_SECRET>`}</pre>
        {!secretSet ? <p className="mt-2 text-xs text-destructive">VOICE_WEBHOOK_SECRET is not set in Vercel — every call will be rejected until it is.</p> : null}
      </section>

      <section className="mt-8 grid grid-cols-3 gap-4">
        {[['Minutes billed (last 200 calls)', String(minutes)], ['Client minutes worth', dollars(revenue)], ['Vapi cost to you', cost ? dollars(cost) : '—']].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p></div>
        ))}
      </section>
      <p className="mt-2 text-xs text-muted-foreground">“Client minutes worth” uses the cents-per-minute you set on each line; the Vapi cost comes from Vapi&apos;s own end-of-call report.</p>

      <section className="mt-8 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-4 py-3 font-medium">Client</th><th className="px-4 py-3 font-medium">Number</th>
            <th className="px-4 py-3 font-medium">Fallback</th><th className="px-4 py-3 font-medium">Minutes left</th></tr></thead>
          <tbody>
            {lines.length === 0 ? <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No phone lines yet.</td></tr> :
              lines.map((l) => (
                <tr key={l.businessId} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{l.businessId}{!l.enabled ? ' (disabled)' : ''}</td>
                  <td className="px-4 py-3 tabular-nums">{l.e164}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{l.forwardTo ?? '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{balances.get(l.businessId)}</td>
                </tr>))}
          </tbody>
        </table>
      </section>
      <p className="mt-2 text-xs text-muted-foreground">Add minutes from <Link href="/admin" className="text-primary underline underline-offset-4">Clients</Link> (1 credit = 1 minute) after a payment clears.</p>

      <section className="mt-8 rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-medium">Shared demo line</p>
        <p className="mb-4 mt-1 text-xs text-muted-foreground">
          {demoLine ? `${demoLine.e164} currently answers as ${demoLine.businessId}. ` : 'No demo line yet. '}
          One number is shared by all prospects, so point it at a prospect&apos;s preview just before they call. Demo calls are free to them and capped at 2 minutes.
        </p>
        <DemoLineForm previewIds={previewIds} hasLine={!!demoLine} />
      </section>

      <section className="mt-8 rounded-xl border border-border bg-card p-5">
        <p className="mb-4 text-sm font-medium">Attach a phone line to a client</p>
        <VoiceLineForm businessIds={businesses.filter((b) => !b.config.id.startsWith('demo-')).map((b) => b.config.id)} />
      </section>

      <section className="mt-8 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-4 py-3 font-medium">When</th><th className="px-4 py-3 font-medium">Client</th><th className="px-4 py-3 font-medium">Caller</th>
            <th className="px-4 py-3 font-medium">Length</th><th className="px-4 py-3 font-medium">Billed</th><th className="px-4 py-3 font-medium">Vapi cost</th></tr></thead>
          <tbody>
            {calls.length === 0 ? <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No calls yet.</td></tr> :
              calls.slice(0, 50).map((c) => (
                <tr key={c.callId} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-xs">{new Date(c.createdAtISO).toLocaleString()}</td>
                  <td className="px-4 py-3">{c.businessId}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{c.caller ?? '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{c.durationSeconds}s</td>
                  <td className="px-4 py-3 tabular-nums">{c.billedMinutes} min</td>
                  <td className="px-4 py-3 tabular-nums text-xs">{c.vapiCostCents != null ? dollars(c.vapiCostCents) : '—'}</td>
                </tr>))}
          </tbody>
        </table>
      </section>
    </main>
  )
}
