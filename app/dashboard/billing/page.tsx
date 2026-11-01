import { getClientSession } from '@/lib/accounts/session'
import { getStoredBusiness } from '@/lib/config/business-store'
import { creditLedger } from '@/lib/billing/credits'
import { getLineForBusiness } from '@/lib/voice/store'
import { loadPaymentLines } from '@/lib/billing/sales-data'
import { summarizeSales } from '@/lib/billing/sales'
import { getSubscriptionInfo } from '@/lib/billing/subscription'
import { whopConfigured } from '@/lib/billing/whop-checkout'
import { PRICING } from '@/lib/billing/whop'
import { CancelSubscription } from './cancel-subscription'

export const metadata = { title: 'Billing' }
export const dynamic = 'force-dynamic'

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : undefined)
const card = 'card p-5'
const link = 'text-primary underline underline-offset-4'

export default async function BillingPage() {
  const session = (await getClientSession())!
  const id = session.businessId!
  const stored = await getStoredBusiness(id)
  const [balance, line, allLines, info] = await Promise.all([creditLedger.getBalance(id), getLineForBusiness(id), loadPaymentLines(), getSubscriptionInfo(id).catch(() => null)])
  const mine = allLines.filter((l) => l.businessId === id)
  const sales = summarizeSales(mine).perClient.get(id)
  const showVoice = (stored?.services ?? 'both') !== 'chat' || !!line
  const whop = whopConfigured()
  const renewal = day(info?.currentPeriodEnd ?? sales?.nextRenewalEstimate)
  const scheduled = info?.cancelAtPeriodEnd === true
  const status = stored?.billingStatus ?? 'active'
  const planName = sales?.plan === 'founding' ? 'Founding client' : sales?.plan === 'standard' ? 'Standard' : undefined

  return (
    <div className="space-y-6">
      <div className={card}>
        <p className="text-sm font-medium">Your plan</p>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-muted-foreground">Plan</dt><dd className="mt-0.5 font-medium">AI Receptionist{planName ? ` · ${planName}` : ''}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-0.5 font-medium capitalize">{status.replace('_', ' ')}{scheduled ? ' · ending' : ''}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{scheduled ? 'Ends on' : 'Next payment'}</dt><dd className="mt-0.5 font-medium">{status === 'cancelled' ? '—' : renewal ?? '—'}{renewal && !info?.currentPeriodEnd ? <span className="text-xs font-normal text-muted-foreground"> (estimate)</span> : null}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">Monthly fee: {money(PRICING.monthly)}. {status === 'awaiting_payment' ? 'We have not received your payment yet. If you have paid, it can take a few minutes to appear.' : ''}</p>
        {info?.manageUrl ? <p className="mt-2 text-xs"><a href={info.manageUrl} target="_blank" rel="noreferrer" className={link}>Update your card or download receipts</a></p> : null}
      </div>

      {showVoice ? (
        <div className={card}>
          <p className="text-sm font-medium">Phone minutes</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{Math.max(0, balance.balance)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Minutes are used by phone calls only. Website chat is unlimited.</p>
          {whop ? (
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <a href="/api/client/billing/minutes?pack=200" className="btn btn-outline">Buy 200 minutes · {money(PRICING.packs.minutes200)}</a>
              <a href="/api/client/billing/minutes?pack=500" className="btn btn-outline">Buy 500 minutes · {money(PRICING.packs.minutes500)}</a>
            </div>
          ) : <p className="mt-3 text-xs text-muted-foreground">To add minutes, send us a message and we will send a payment link.</p>}
          <p className="mt-2 text-xs text-muted-foreground">Minutes are added automatically after you pay.</p>
          {balance.transactions.length > 0 ? (
            <ul className="mt-4 divide-y divide-border text-sm">
              {[...balance.transactions].slice(-8).reverse().map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">{t.note ?? t.type} · {new Date(t.createdAtISO).toLocaleDateString()}</span>
                  <span className={t.amount >= 0 ? 'text-primary' : ''}>{t.amount >= 0 ? '+' : ''}{t.amount}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className={card}>
        <p className="text-sm font-medium">Payment history</p>
        {mine.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No payments recorded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border text-sm">
            {[...mine].reverse().map((l, i) => (
              <li key={l.eventId ?? i} className="flex items-center justify-between py-2">
                <span><span className="text-muted-foreground">{day(l.at)}</span> · {l.note}</span>
                <span className="tabular-nums">{money(l.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        {sales ? <p className="mt-3 text-xs text-muted-foreground">Total paid: {money(sales.totalPaid)}</p> : null}
      </div>

      {status !== 'cancelled' && (sales?.plan || info) ? (
        <div className={card}>
          <p className="text-sm font-medium">End your subscription</p>
          <div className="mt-3"><CancelSubscription scheduled={scheduled} endsOn={renewal} /></div>
        </div>
      ) : null}
    </div>
  )
}
