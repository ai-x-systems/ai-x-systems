import { getClientSession } from '@/lib/accounts/session'
import { listRecentActivity } from '@/lib/activity/log'
import { DeleteButton } from '@/components/delete-button'

export const metadata = { title: 'Leads' }
export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const session = (await getClientSession())!
  const activity = await listRecentActivity(session.businessId!, 200)

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Leads &amp; bookings ({activity.length}{activity.length === 200 ? '+' : ''})</p>
        <a href="/api/client/leads" className="text-xs text-primary underline underline-offset-4">Download all (CSV)</a>
      </div>
      {activity.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing yet. Every enquiry the assistant collects appears here, and is sent to your alert email and any integrations you connect.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {activity.map((e) => {
            const d = e.data as Record<string, unknown>
            const contact = [d.callerEmail, d.callerPhone].filter((v): v is string => typeof v === 'string' && v.length > 0)
            return (
              <li key={e.id} className="py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium">
                    {e.type === 'booking' ? 'Booking' : 'Lead'}
                    {typeof d.callerName === 'string' && d.callerName ? ` — ${d.callerName}` : ''}
                    {d.demo ? <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-normal text-secondary-foreground">test</span> : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{new Date(e.createdAtISO).toLocaleString()}</span>
                </div>
                <p className="mt-0.5 text-muted-foreground">
                  {e.type === 'booking' ? [d.serviceName, d.startTimeISO].filter(Boolean).join(' at ') : (d.reason as string | undefined) ?? ''}
                </p>
                {contact.length ? <p className="mt-0.5 text-xs">{contact.join(' · ')}</p> : null}
                <div className="mt-1">
                  <DeleteButton endpoint={`/api/client/leads?id=${encodeURIComponent(e.id)}`} label="Delete" warning="Removes this lead from your list. It does not recall emails or CRM entries already sent." />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
