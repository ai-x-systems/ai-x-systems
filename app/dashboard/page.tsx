import Link from 'next/link'
import { getClientSession } from '@/lib/accounts/session'
import { getStoredBusiness } from '@/lib/config/business-store'
import { creditLedger } from '@/lib/billing/credits'
import { getLineForBusiness } from '@/lib/voice/store'
import { listRecentActivity } from '@/lib/activity/log'
import { whopConfigured } from '@/lib/billing/whop-checkout'

export const dynamic = 'force-dynamic'

const card = 'rounded-xl border border-border bg-card p-5'
const link = 'text-primary underline underline-offset-4'

export default async function OverviewPage() {
  const session = (await getClientSession())!
  const id = session.businessId!
  const stored = await getStoredBusiness(id)
  const business = stored?.config
  const services = stored?.services ?? 'both'
  const [balance, activity, line] = await Promise.all([creditLedger.getBalance(id), listRecentActivity(id, 2000), getLineForBusiness(id)])
  const showVoice = services !== 'chat' || !!line
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const thisMonth = activity.filter((a) => new Date(a.createdAtISO) >= monthStart).length
  const lowMinutes = balance.balance < (Number(process.env.VOICE_LOW_BALANCE_MINUTES) || 15)
  const integ = business?.integrations
  const connected = !!(integ?.webhookUrl || integ?.leadSheetId)
  const paid = stored?.billingStatus === 'active'
  const whop = whopConfigured()

  const steps: { done?: boolean; text: string; href: string }[] = [
    { done: paid, text: paid ? 'Subscription active' : 'Subscription: payment not confirmed yet', href: '/dashboard/billing' },
    ...(services !== 'voice' ? [{ text: 'Add the chat to your website', href: '/dashboard/chat' }] : []),
    { done: connected, text: connected ? 'Leads are sent to your CRM / sheet' : 'Send new leads to your CRM or Google Sheet', href: '/dashboard/integrations' },
    ...(showVoice ? [{ done: !!line, text: line ? `Phone line ready: ${line.e164}` : 'Phone line: we will set this up and message you', href: '/dashboard/settings' }] : []),
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className={card}>
          <p className="text-sm text-muted-foreground">Receptionist</p>
          <p className="mt-2 text-xl font-semibold">{business?.demo ? 'Demo mode' : stored && !stored.active ? 'Paused' : 'Live'}</p>
          {stored?.source === 'db' ? <p className="mt-1 text-xs text-muted-foreground">Billing: {stored.billingStatus.replace('_', ' ')}</p> : null}
          {stored && !stored.active ? <p className="mt-1 text-xs text-destructive">It isn&apos;t answering right now. <Link href="/dashboard/settings" className={link}>Turn it back on</Link></p> : null}
        </div>
        <div className={card}>
          <p className="text-sm text-muted-foreground">Leads this month</p>
          <p className="mt-2 text-xl font-semibold tabular-nums">{thisMonth}</p>
          <p className="mt-1 text-xs text-muted-foreground">{activity.length} in total · <Link href="/dashboard/leads" className={link}>see all</Link></p>
        </div>
        {showVoice ? (
          <div className={card}>
            <p className="text-sm text-muted-foreground">Phone minutes left</p>
            <p className="mt-2 text-xl font-semibold tabular-nums">{Math.max(0, balance.balance)}</p>
            {line && lowMinutes ? <p className="mt-1 text-xs text-destructive">{balance.balance < 1 ? 'Out of minutes. ' : 'Running low. '}{line.forwardTo ? 'Calls are passed to your team when minutes run out.' : 'Callers hear a polite message when minutes run out.'}</p> : null}
            <p className="mt-1 text-xs text-muted-foreground">
              {whop ? (<><a href="/api/client/billing/minutes?pack=200" className={link}>Buy 200 ($50)</a>{' · '}<a href="/api/client/billing/minutes?pack=500" className={link}>Buy 500 ($110)</a></>) : <Link href="/dashboard/billing" className={link}>Top up</Link>}
            </p>
          </div>
        ) : (
          <div className={card}>
            <p className="text-sm text-muted-foreground">Plan</p>
            <p className="mt-2 text-xl font-semibold">Website chat</p>
            <p className="mt-1 text-xs text-muted-foreground"><Link href="/dashboard/billing" className={link}>Billing &amp; plan</Link></p>
          </div>
        )}
      </div>

      <div className={card}>
        <p className="text-sm font-medium">Get set up</p>
        <ul className="mt-3 space-y-2 text-sm">
          {steps.map((s) => (
            <li key={s.text} className="flex items-center gap-2">
              <span aria-hidden className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${s.done ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'}`}>{s.done ? '✓' : '•'}</span>
              <Link href={s.href} className={s.done ? 'text-muted-foreground' : link}>{s.text}</Link>
            </li>
          ))}
        </ul>
      </div>

      <div className={card}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Latest leads &amp; bookings</p>
          <Link href="/dashboard/leads" className={`text-xs ${link}`}>View all</Link>
        </div>
        {activity.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing yet. This fills in as customers chat or call.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {activity.slice(0, 5).map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                <span>
                  <span className="font-medium">{e.type === 'booking' ? 'Booking' : 'Lead'}{typeof e.data.callerName === 'string' && e.data.callerName ? ` — ${e.data.callerName}` : ''}</span>
                  <span className="block text-muted-foreground">{e.type === 'booking' ? [e.data.serviceName, e.data.startTimeISO].filter(Boolean).join(' at ') : (e.data.reason as string | undefined) ?? ''}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{new Date(e.createdAtISO).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
