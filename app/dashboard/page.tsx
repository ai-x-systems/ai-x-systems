import { redirect } from 'next/navigation'
import { getClientSession } from '@/lib/accounts/session'
import { getStoredBusiness, installSnippet } from '@/lib/config/business-store'
import { creditLedger } from '@/lib/billing/credits'
import { getLineForBusiness, listCalls } from '@/lib/voice/store'
import { listRecentActivity } from '@/lib/activity/log'
import { PageHeader } from '@/components/page-header'
import { AppTopbar } from '@/components/app-topbar'
import { siteConfig } from '@/lib/site-config'
import { LogoutButton } from './logout-button'

export const metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const session = await getClientSession()
  if (!session) redirect('/client/login')
  if (!session.businessId) redirect('/client/login')

  const stored = await getStoredBusiness(session.businessId)
  const business = stored?.config
  const origin = siteConfig.brand.baseUrl.replace(/\/+$/, '')
  const snippet = installSnippet(origin, session.businessId)
  const balance = await creditLedger.getBalance(session.businessId)
  const activity = await listRecentActivity(session.businessId, 25)
  const [line, calls] = await Promise.all([getLineForBusiness(session.businessId), listCalls(session.businessId, 10)])
  const topupUrl = process.env.VOICE_TOPUP_URL
  const lowMinutes = balance.balance < (Number(process.env.VOICE_LOW_BALANCE_MINUTES) || 15)

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-16 md:px-6">
      <AppTopbar current="client" />
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          eyebrow={business?.name}
          title="Dashboard"
          description={session.email}
        />
        <LogoutButton role="client" />
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Phone minutes left</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{Math.max(0, balance.balance)}</p>
          {line && lowMinutes ? (
            <p className="mt-1 text-xs text-destructive">
              {balance.balance < 1 ? 'Out of minutes — ' : 'Running low — '}
              {line.forwardTo ? 'calls are passed to your team when minutes run out.' : 'callers hear a polite message when minutes run out.'}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {topupUrl ? (
              <a href={topupUrl} className="text-primary underline underline-offset-4">Buy more minutes</a>
            ) : (
              <a href={`mailto:${siteConfig.contact.email}?subject=Top up minutes — ${business?.name ?? ''}`} className="text-primary underline underline-offset-4">Reach out</a>
            )}{' '}
            {topupUrl ? '— pay with the email you log in with and minutes are added automatically.' : "and we'll send a payment link to top up."}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Receptionist status</p>
          <p className="mt-2 text-lg font-medium">
            {business?.demo ? 'Demo mode' : stored && !stored.active ? 'Paused' : 'Live'}
          </p>
          {stored?.source === 'db' && stored.billingStatus !== 'active' ? (
            <p className="mt-1 text-xs text-muted-foreground">Billing: {stored.billingStatus.replace('_', ' ')}</p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {business?.industry ?? '—'}
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Recent leads &amp; bookings</p>
          <a href="/api/client/leads" className="text-xs text-primary underline underline-offset-4">Download all (CSV)</a>
        </div>
        {activity.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing yet — this fills in as calls come through.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {activity.map((entry) => (
              <li key={entry.id} className="py-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {entry.type === 'booking' ? 'Booking' : 'Lead'}
                    {typeof entry.data.callerName === 'string' && entry.data.callerName
                      ? ` — ${entry.data.callerName}`
                      : ''}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.createdAtISO).toLocaleString()}
                  </span>
                </div>
                <p className="mt-0.5 text-muted-foreground">
                  {entry.type === 'booking'
                    ? [entry.data.serviceName, entry.data.startTimeISO].filter(Boolean).join(' at ')
                    : (entry.data.reason as string | undefined) ?? ''}
                </p>
                {(() => {
                  const contact = [entry.data.callerEmail, entry.data.callerPhone].filter((v): v is string => typeof v === 'string' && v.length > 0)
                  return contact.length ? <p className="mt-0.5 text-xs">{contact.join(' · ')}</p> : null
                })()}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <p className="text-sm font-medium">Put the assistant on your website</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Paste this line into your site (before the closing body tag, or in your site builder&apos;s custom-code / header box).
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-secondary p-3 text-xs">{snippet}</pre>
        <p className="mt-2 text-xs text-muted-foreground">
          No access to your site? Share this chat link anywhere: <span className="break-all">{origin}/embed/chat/{session.businessId}</span>
        </p>
      </div>

      {line ? (
        <div className="mt-8 rounded-xl border border-border bg-card p-6">
          <p className="text-sm font-medium">Your AI phone line</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{line.e164}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Point your business line at this number (ask your phone provider to forward unanswered or after-hours calls here), or give it out directly.
          </p>
          {calls.length > 0 ? (
            <ul className="mt-4 divide-y divide-border text-sm">
              {calls.map((c) => (
                <li key={c.callId} className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">{new Date(c.createdAtISO).toLocaleString()}{c.caller ? ` · ${c.caller}` : ''}</span>
                  <span className="tabular-nums">{c.durationSeconds}s · {c.billedMinutes} min</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-xs text-muted-foreground">No calls yet.</p>}
        </div>
      ) : null}

      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <p className="text-sm font-medium">Minutes activity</p>
        {balance.transactions.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {balance.transactions
              .slice(-10)
              .reverse()
              .map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-muted-foreground">
                    {t.note ?? t.type} — {new Date(t.createdAtISO).toLocaleDateString()}
                  </span>
                  <span className={t.amount >= 0 ? 'text-primary' : 'text-foreground'}>
                    {t.amount >= 0 ? '+' : ''}
                    {t.amount}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </main>
  )
}
