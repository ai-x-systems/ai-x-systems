import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAdminSession } from '@/lib/accounts/session'
import { AppTopbar } from '@/components/app-topbar'
import { PageHeader } from '@/components/page-header'
import { getSettings, stageCounts, listMessages, listLeads, sentSince } from '@/lib/growth/store'
import { growthReadiness } from '@/lib/growth/send'
import { listProspects } from '@/lib/leads/prospects'
import { RunButtons, SettingsForm, QueueItem, LeadActions, PreviewLinks } from './growth-client'

export const metadata = { title: 'Growth' }
export const dynamic = 'force-dynamic'

const FUNNEL: Array<[string, string]> = [
  ['discovered', 'Found'], ['enriched', 'Email found'], ['contacted', 'Contacted'],
  ['replied', 'Replied'], ['demo_booked', 'Demo booked'], ['won', 'Won'],
]

export default async function GrowthPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin-login')

  const day = new Date(); day.setUTCHours(0, 0, 0, 0)
  const [settings, counts, queue, leads, inbound, sentToday, sent7d] = await Promise.all([
    getSettings(), stageCounts(), listMessages('draft', 30),
    listLeads({ stage: ['contacted', 'replied', 'demo_booked', 'won', 'queued', 'drafted'], limit: 60 }),
    listProspects(), sentSince(day.toISOString()), sentSince(new Date(Date.now() - 7 * 86400000).toISOString()),
  ])
  const readiness = growthReadiness()
  const manual = settings.sendMode !== 'auto'
  const addr = (process.env.GROWTH_PHYSICAL_ADDRESS ?? '').trim()
  const manualFooter = `\n\n--\nAI x Systems${addr ? ' · ' + addr : ''}\nNot interested? Just reply "no" and I won't email you again.`
  const c = (k: string) => counts[k] ?? 0
  const contactedEver = c('contacted') + c('replied') + c('demo_booked') + c('won')
  const replies = c('replied') + c('demo_booked') + c('won')
  const inboundNew = inbound.filter((p) => p.status === 'new').length

  const funnelCount = (k: string) => k === 'contacted' ? contactedEver : k === 'replied' ? replies : k === 'enriched' ? c('enriched') + c('drafted') + c('queued') + contactedEver : k === 'discovered' ? Object.values(counts).reduce((a, b) => a + b, 0) : c(k)

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-16 md:px-6">
      <AppTopbar current="admin" />
      <div className="flex items-start justify-between gap-4">
        <PageHeader eyebrow="Admin" title="Growth" description="Find prospects, email them, track replies — automatically." />
        <div className="flex gap-4 text-sm">
          <Link href="/admin" className="text-primary underline underline-offset-4">Clients</Link>
          <Link href="/admin/inquiries" className="text-primary underline underline-offset-4">Inquiries{inboundNew ? ` (${inboundNew} new)` : ''}</Link>
        </div>
      </div>

      <section className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-6">
        {FUNNEL.map(([k, label]) => (
          <div key={k} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{funnelCount(k)}</p>
          </div>
        ))}
      </section>
      <p className="mt-2 text-xs text-muted-foreground">
        Sent today {sentToday} · last 7 days {sent7d} · reply rate {contactedEver ? Math.round((replies / contactedEver) * 100) : 0}% · inbound demo requests {inbound.length} ({inboundNew} new)
      </p>

      <section className="mt-8 rounded-xl border border-border bg-card p-5">
        {manual ? (
          <>
            <p className="text-sm font-medium">Manual mode — nothing is sent by the system</p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
              <li>The system finds leads, finds their emails and writes each message below.</li>
              <li>You press <b>Copy email</b>, paste it into your own mailbox and send it to that one person.</li>
              <li>Press <b>I sent it</b>. Follow-ups are then written for you automatically (3 and 7 days later).</li>
              <li>If they reply, press <b>Replied</b> on the lead. If they say no, press <b>Never contact</b>.</li>
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">
              Keep it to a handful a day and send each one individually. {addr ? '' : <span className="text-destructive">Set GROWTH_PHYSICAL_ADDRESS in Vercel: US law requires a postal address in commercial email. </span>}
              Automatic sending comes later, after you have your own domain.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">Sending readiness {readiness.ok ? '— all clear' : '— not ready to send yet'}</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {readiness.checks.map((k) => (
                <li key={k.label} className="text-xs">
                  <span className={k.ok ? 'text-primary' : 'text-destructive'}>{k.ok ? '✓' : '✗'}</span> <span className="font-medium">{k.label}</span>
                  {!k.ok ? <span className="block text-muted-foreground">{k.hint}</span> : null}
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="mt-4"><RunButtons manual={manual} /></div>
        {!manual ? <p className="mt-2 text-xs text-muted-foreground">A daily run also happens automatically on weekdays. New sending domains warm up gradually: about 5 emails on day one, growing by 3 a day up to your cap.</p> : null}
      </section>

      <section className="mt-8">
        <p className="text-sm font-medium">{manual ? 'Emails to send' : 'Approval queue'} ({queue.length}){!manual && settings.autoSend ? ' — automatic sending is ON, so new emails skip this queue' : ''}</p>
        <div className="mt-3 space-y-3">
          {queue.length === 0 ? <div className="rounded-xl border border-border p-5 text-center text-sm text-muted-foreground">Nothing waiting for approval.</div> :
            queue.map((m) => <QueueItem key={m.id} id={m.id} to={m.lead?.email ?? '?'} business={m.lead?.businessName ?? '?'} subject={m.subject} body={m.bodyText} step={m.step} manual={manual} footer={manualFooter} />)}
        </div>
      </section>

      <section className="mt-8 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-4 py-3 font-medium">Business</th><th className="px-4 py-3 font-medium">Stage</th>
            <th className="px-4 py-3 font-medium">Preview</th><th className="px-4 py-3 font-medium">Score</th><th className="px-4 py-3 font-medium">Contact</th><th className="px-4 py-3 font-medium">Mark</th></tr></thead>
          <tbody>
            {leads.length === 0 ? <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No active leads yet. Add cities in settings, then press “Run full cycle”.</td></tr> :
              leads.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3"><div className="font-medium">{l.businessName}</div><div className="text-xs text-muted-foreground">{[l.industry, l.city].filter(Boolean).join(' · ')}{l.signals.chatWidget === false ? ' · no chat widget' : ''}</div></td>
                  <td className="px-4 py-3"><span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{l.stage.replace('_', ' ')}{l.stage === 'contacted' ? ` (${l.step}/3)` : ''}</span></td>
                  <td className="px-4 py-3"><PreviewLinks businessId={l.demoBusinessId} /></td>
                  <td className="px-4 py-3 tabular-nums">{l.score}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{l.email}</td>
                  <td className="px-4 py-3"><LeadActions id={l.id} stage={l.stage} /></td>
                </tr>))}
          </tbody>
        </table>
      </section>

      <section className="mt-8 rounded-xl border border-border bg-card p-5">
        <p className="mb-4 text-sm font-medium">Targeting &amp; sending settings</p>
        <SettingsForm initial={settings} />
      </section>
    </main>
  )
}
