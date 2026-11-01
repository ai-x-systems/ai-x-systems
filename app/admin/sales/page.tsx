import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAdminSession } from '@/lib/accounts/session'
import { listStoredBusinesses } from '@/lib/config/business-store'
import { loadMinutesStats, loadSales } from '@/lib/billing/sales-data'
import { getSubscriptionInfo, type SubscriptionInfo } from '@/lib/billing/subscription'
import { PRICING } from '@/lib/billing/whop'
import { AppTopbar } from '@/components/app-topbar'
import { PageHeader } from '@/components/page-header'
import { DeleteButton } from '@/components/delete-button'
import { ManualPaymentForm } from './manual-payment-form'
import { SubscriptionActions } from './subscription-actions'

export const metadata = { title: 'Sales' }
export const dynamic = 'force-dynamic'

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—')
const PLAN_NAME: Record<string, string> = { founding: 'Founding', standard: 'Standard' }

export default async function SalesPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin-login')

  const [{ lines, summary }, stats, stored] = await Promise.all([loadSales(), loadMinutesStats(), listStoredBusinesses()])
  const clients = stored.filter((b) => b.source === 'db' && !b.config.demo)
  const names = new Map(stored.map((b) => [b.config.id, b.config.name]))

  // Live renewal dates from Whop where the API key allows it (capped so the page stays fast); otherwise an estimate.
  const subscribers = clients.filter((b) => summary.perClient.get(b.config.id)?.plan).slice(0, 25)
  const infos = new Map<string, SubscriptionInfo | null>(
    await Promise.all(subscribers.map(async (b) => [b.config.id, await getSubscriptionInfo(b.config.id).catch(() => null)] as const))
  )

  const activeSubscribers = clients.filter((b) => b.billingStatus === 'active' && summary.perClient.get(b.config.id)?.plan).length
  const mrr = activeSubscribers * PRICING.monthly
  const vapiCost = [...stats.values()].reduce((n, m) => n + m.vapiCostCents, 0) / 100
  const t = summary.totals

  const card = (label: string, value: string, hint?: string) => (
    <div className="card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  )

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-16 md:px-6">
      <AppTopbar current="admin" />
      <div className="flex items-start justify-between gap-4">
        <PageHeader eyebrow="Admin" title="Sales" description="Money in, per client: setup fees, subscriptions, minutes, renewals." />
        <div className="flex items-center gap-4">
          <a href="/api/admin/sales/export" className="btn btn-outline btn-sm">Download CSV</a>
          <Link href="/admin" className="btn btn-outline btn-sm">Back to Clients</Link>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {card('Total revenue', money(t.revenue), `${t.payments} payment(s), before Whop fees`)}
        {card('This month', money(t.thisMonth))}
        {card('Monthly recurring (MRR)', money(mrr), `${activeSubscribers} active subscriber(s) × ${money(PRICING.monthly)}`)}
        {card('Setup fees', money(t.setup))}
        {card('Subscriptions', money(t.subscription), 'monthly fees collected')}
        {card('Voice minutes sold', money(t.minutes))}
        {card('Vapi cost so far', money(vapiCost), 'all calls, demos included')}
        {card('After Vapi cost', money(t.revenue - vapiCost), 'before Whop fees and hosting')}
      </div>

      <h2 className="mt-10 text-sm font-medium">By client</h2>
      <div className="mt-2 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              {['Client', 'Plan', 'Billing', 'Setup paid', 'Monthly paid', 'Minutes bought / used / left', 'Total paid', 'First paid', 'Next renewal', 'Subscription'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">No paying clients yet.</td></tr>
            ) : clients.map((b) => {
              const id = b.config.id
              const c = summary.perClient.get(id)
              const m = stats.get(id)
              const info = infos.get(id)
              const renewal = info?.currentPeriodEnd ?? c?.nextRenewalEstimate
              const scheduled = info?.cancelAtPeriodEnd === true
              return (
                <tr key={id} className="border-b border-border align-top last:border-0">
                  <td className="px-3 py-2"><div className="font-medium">{b.config.name}</div><div className="text-muted-foreground">{id}</div></td>
                  <td className="px-3 py-2">{c?.plan ? PLAN_NAME[c.plan] : '—'}</td>
                  <td className="px-3 py-2">{b.billingStatus.replace('_', ' ')}{!b.active ? <div className="text-destructive">paused</div> : null}</td>
                  <td className="px-3 py-2 tabular-nums">{c ? money(c.setupPaid) : '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{c ? money(c.subscriptionPaid) : '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{m ? `${m.bought} / ${m.used} / ${m.left}` : '0 / 0 / 0'}</td>
                  <td className="px-3 py-2 tabular-nums font-medium">{c ? money(c.totalPaid) : '—'}</td>
                  <td className="px-3 py-2">{day(c?.firstPaidAt)}</td>
                  <td className="px-3 py-2">{scheduled ? <span className="text-destructive">Ends {day(renewal)}</span> : <>{day(renewal)}{renewal && !info?.currentPeriodEnd ? <span className="text-muted-foreground"> (est.)</span> : null}</>}</td>
                  <td className="px-3 py-2"><SubscriptionActions businessId={id} scheduled={scheduled} canCancel={!!c?.plan && b.billingStatus !== 'cancelled'} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Renewal dates are exact when your Whop API key may read memberships, otherwise last subscription payment + 1 month. Payments made before the Whop connection appear only if you record them below.</p>

      {summary.unmatched.length > 0 ? (
        <div className="mt-8 card p-4">
          <p className="text-sm font-medium">Payments waiting for an account ({summary.unmatched.length})</p>
          <p className="mt-1 text-xs text-muted-foreground">These were paid before the client finished setup. They are applied automatically when that email completes its setup link.</p>
          <ul className="mt-2 divide-y divide-border text-xs">
            {summary.unmatched.map((l, i) => <li key={i} className="flex justify-between py-1.5"><span>{l.email ?? 'unknown email'} · {l.note}</span><span className="tabular-nums">{money(l.amount)} · {day(l.at)}</span></li>)}
          </ul>
        </div>
      ) : null}

      <h2 className="mt-10 text-sm font-medium">All payments</h2>
      <div className="mt-2 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-xs">
          <thead><tr className="border-b border-border text-muted-foreground">{['Date', 'Client', 'What', 'Amount', 'Source', ''].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No payments recorded yet.</td></tr>
            ) : [...lines].reverse().slice(0, 100).map((l, i) => (
              <tr key={l.eventId ?? i} className="border-b border-border last:border-0">
                <td className="px-3 py-2">{day(l.at)}</td>
                <td className="px-3 py-2">{l.businessId ? names.get(l.businessId) ?? `${l.businessId} (deleted)` : <span className="text-muted-foreground">{l.email ?? 'no client'}</span>}</td>
                <td className="px-3 py-2">{l.note}</td>
                <td className="px-3 py-2 tabular-nums">{money(l.amount)}</td>
                <td className="px-3 py-2">{l.manual ? 'manual' : 'Whop'}</td>
                <td className="px-3 py-2">{l.manual && l.eventId ? <DeleteButton endpoint={`/api/admin/billing/manual?id=${encodeURIComponent(l.eventId)}`} label="Remove" warning="Removes this entry from the sales list only. It does not undo billing status or minutes." /> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8">
        <ManualPaymentForm clients={clients.map((b) => ({ id: b.config.id, name: b.config.name }))} />
      </div>
    </main>
  )
}
