import { getClientSession } from '@/lib/accounts/session'
import { getStoredBusiness } from '@/lib/config/business-store'
import { getLineForBusiness, listCalls } from '@/lib/voice/store'
import { creditLedger } from '@/lib/billing/credits'
import { whopConfigured } from '@/lib/billing/whop-checkout'
import { clockDuration, digitsOnly, formatPhone } from '@/lib/voice/format'
import { DashHeader } from '@/components/dash-header'
import { CopyField } from '@/components/copy-field'
import { PhoneRequestCard } from '@/components/request-forms'
import { listRequests } from '@/lib/requests/store'

export const metadata = { title: 'Phone line' }
export const dynamic = 'force-dynamic'

const link = 'text-primary underline underline-offset-4'

export default async function PhonePage() {
  const session = (await getClientSession())!
  const id = session.businessId!
  const stored = await getStoredBusiness(id)
  const [line, balance, calls] = await Promise.all([getLineForBusiness(id), creditLedger.getBalance(id), listCalls(id, 15).catch(() => [])])
  const latestPhone = (await listRequests({ businessId: id }).catch(() => [])).find((r) => r.kind === 'phone') ?? null
  const whop = whopConfigured()
  const num = line ? digitsOnly(line.e164) : '1XXXXXXXXXX'

  return (
    <div className="space-y-6">
      <DashHeader title="Phone line" description="The number your assistant answers, and how to send your calls to it." />

      {line ? (
        <div className="card stat p-5">
          <p className="text-xs text-muted-foreground">Your AI phone number</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{formatPhone(line.e164)}</p>
          <div className="mt-3 max-w-sm"><CopyField value={line.e164} /></div>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-0.5 font-medium">{line.enabled ? 'Answering calls' : 'Switched off'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Minutes left</dt><dd className="mt-0.5 font-medium tabular-nums">{Math.max(0, balance.balance)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">When minutes run out</dt><dd className="mt-0.5 font-medium">{line.forwardTo ? `Calls go to ${formatPhone(line.forwardTo)}` : 'Callers hear a polite message'}</dd></div>
          </dl>
          {whop ? (
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <a href="/api/client/billing/minutes?pack=200" className="btn btn-outline btn-sm">Buy 200 minutes · $50</a>
              <a href="/api/client/billing/minutes?pack=500" className="btn btn-outline btn-sm">Buy 500 minutes · $110</a>
            </div>
          ) : null}
        </div>
      ) : (
        <PhoneRequestCard latest={latestPhone ? { status: latestPhone.status, createdAtISO: latestPhone.createdAtISO } : null} />
      )}

      {line ? (
      <div className="card p-5">
        <p className="text-sm font-medium">Send your calls to your assistant</p>
        <p className="mt-1 text-xs text-muted-foreground">Three common ways. Phone plans differ, so if a code doesn&apos;t work, ask your carrier for &quot;conditional call forwarding&quot; or look under Call forwarding in your phone&apos;s settings.</p>
        <ol className="mt-4 space-y-4 text-sm">
          <li><span className="font-medium">1. Give out the number.</span><span className="block text-muted-foreground">Put it on your website, Google listing and cards. Every call is answered.</span></li>
          <li>
            <span className="font-medium">2. Forward calls you miss.</span>
            <span className="block text-muted-foreground">Your phone rings first and the assistant picks up when you don&apos;t answer. Dial one of these from your business phone (replace the digits with the number above):</span>
            <span className="mt-2 block overflow-x-auto rounded-lg bg-secondary p-3 font-mono text-xs leading-6">
              AT&amp;T / T-Mobile: **61*+{num}#   (no answer)<br />
              AT&amp;T / T-Mobile: **67*+{num}#   (busy)<br />
              Verizon: *71{num}   (no answer or busy)<br />
              Turn it off: ##002# (AT&amp;T / T-Mobile) or *73 (Verizon)
            </span>
          </li>
          <li>
            <span className="font-medium">3. Forward everything after hours.</span>
            <span className="block text-muted-foreground">Dial <span className="font-mono text-foreground">*72{num}</span> (most US carriers) at closing time and <span className="font-mono text-foreground">*73</span> in the morning. Business phone systems like RingCentral or Google Voice have the same option as an after-hours rule in their settings.</span>
          </li>
        </ol>
      </div>

      ) : null}

      {line ? (
      <div className="card p-5">
        <p className="text-sm font-medium">Try it now</p>
        <p className="mt-1 text-sm text-muted-foreground">Call {line ? <span className="font-medium text-foreground">{formatPhone(line.e164)}</span> : 'your number'} from your own phone and ask about your opening hours. Anything the assistant gets wrong can be fixed on the <a href="/dashboard/knowledge" className={link}>What it knows</a> page.</p>
      </div>
      ) : null}

      <div className="card p-5">
        <p className="text-sm font-medium">Recent calls</p>
        {calls.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No calls yet. They will appear here with how long each one lasted.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="py-2 pr-4 font-medium">When</th><th className="py-2 pr-4 font-medium">Caller</th><th className="py-2 pr-4 font-medium">Length</th><th className="py-2 font-medium">Minutes used</th></tr></thead>
              <tbody>
                {calls.map((c) => (
                  <tr key={c.callId} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4 whitespace-nowrap">{new Date(c.createdAtISO).toLocaleString()}</td>
                    <td className="py-2 pr-4">{c.caller ? formatPhone(c.caller) : 'Unknown'}</td>
                    <td className="py-2 pr-4 tabular-nums">{clockDuration(c.durationSeconds)}</td>
                    <td className="py-2 tabular-nums">{c.billedMinutes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
