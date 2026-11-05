import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { getAdminSession } from '@/lib/accounts/session'
import { accountStore } from '@/lib/accounts/store'
import { listStoredBusinesses } from '@/lib/config/business-store'
import { creditLedger } from '@/lib/billing/credits'
import { whopConfigured } from '@/lib/billing/whop-checkout'
import { CreditAdjustForm } from './credit-adjust-form'
import { CreateClientForm } from './create-client-form'
import { TestEmailButton } from './test-email-button'
import { ClientStatusControls } from './client-status-controls'
import { PaymentLinkButton } from './payment-link-button'
import { DeleteButton } from '@/components/delete-button'
import { getSupabaseClient } from '@/lib/supabase/client'
import { DashHeader } from '@/components/dash-header'

export const metadata = { title: 'Admin' }

const TONES = {
  good: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  warn: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  bad: 'border-red-400/30 bg-red-400/10 text-red-300',
  info: 'border-primary/30 bg-primary/10 text-primary',
  mute: 'border-border bg-muted/40 text-muted-foreground',
} as const

function Chip({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>
}

function billingChip(status: string, editable: boolean) {
  if (!editable) return <Chip tone="mute">file-based</Chip>
  const label = status.replace('_', ' ')
  const tone = status === 'active' ? 'good' : status === 'awaiting_payment' ? 'warn' : status === 'past_due' ? 'bad' : 'mute'
  return <Chip tone={tone}>{label}</Chip>
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'warn' | 'bad' }) {
  return (
    <div className="card stat p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone === 'warn' ? 'text-amber-300' : tone === 'bad' ? 'text-red-300' : ''}`}>{value}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  )
}

export default async function AdminPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin-login')

  const accounts = await accountStore.list()
  const stored = new Map((await listStoredBusinesses()).map((b) => [b.config.id, b]))
  const clients = await Promise.all(
    accounts
      .filter((a) => a.role === 'client' && a.businessId)
      .map(async (a) => {
        const sb = stored.get(a.businessId!)
        const business = sb?.config
        const balance = await creditLedger.getBalance(a.businessId!)
        return {
          accountId: a.id,
          email: a.email,
          businessId: a.businessId!,
          businessName: business?.name ?? '(unknown business)',
          industry: business?.industry,
          demo: business?.demo ?? false,
          creditBalance: balance.balance,
          history: balance.transactions.slice(-8).reverse().map((t) => ({ id: t.id, amount: t.amount, type: t.type, note: t.note ?? '', at: t.createdAtISO })),
          active: sb?.active ?? true,
          billingStatus: sb?.billingStatus ?? 'active',
          editable: sb?.source === 'db',
        }
      })
  )

  const whopReady = whopConfigured()
  const { data: paymentRows } = await getSupabaseClient()
    .from('billing_events')
    .select('type,email,business_id,created_at')
    .like('type', 'whop.%')
    .order('created_at', { ascending: false })
    .limit(10)
  const payments = paymentRows ?? []
  const { data: intakeRows } = await getSupabaseClient()
    .from('client_intakes')
    .select('id,business_name,client_email,services,paid,expires_at,created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(20)
  const pendingLinks = (intakeRows ?? []).filter((r) => new Date(r.expires_at).getTime() > Date.now())

  const real = clients.filter((c) => !c.demo)
  const stats = {
    total: clients.length,
    active: real.filter((c) => c.editable && c.billingStatus === 'active').length,
    awaiting: real.filter((c) => c.editable && c.billingStatus === 'awaiting_payment').length,
    paused: clients.filter((c) => !c.active).length,
  }

  return (
    <div>
      <DashHeader title="Clients" description="Everyone you serve: billing, minutes and their assistant, in one place." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Clients" value={stats.total} />
        <Stat label="Billing active" value={stats.active} />
        <Stat label="Awaiting payment" value={stats.awaiting} tone={stats.awaiting ? 'warn' : undefined} />
        <Stat label="Assistants paused" value={stats.paused} tone={stats.paused ? 'bad' : undefined} />
      </div>

      <div className="mt-8 space-y-3">
        {clients.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="font-medium">No clients yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Create your first client to see them here.</p>
            <Link href="/admin/onboard" className="btn btn-primary mt-4">+ Onboard a client</Link>
          </div>
        ) : (
          clients.map((c) => (
            <details key={c.accountId} className="group card overflow-hidden transition-shadow open:shadow-xl open:shadow-primary/10">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-3 p-4 transition-colors hover:bg-muted/30 sm:p-5 [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-cyan-400 text-base font-semibold text-white shadow-lg shadow-primary/20">
                  {c.businessName.trim().charAt(0).toUpperCase() || '?'}
                </span>
                <div className="min-w-0 flex-1 basis-52">
                  <p className="truncate font-semibold">{c.businessName}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.businessId}{c.industry ? ` · ${c.industry}` : ''}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip tone={c.demo ? 'mute' : 'info'}>{c.demo ? 'Demo' : 'Live'}</Chip>
                  {billingChip(c.billingStatus, c.editable)}
                  {!c.active ? <Chip tone="bad">assistant paused</Chip> : null}
                </div>
                <div className="ml-auto flex items-center gap-4">
                  <div className="text-right leading-tight">
                    <p className="text-xl font-semibold tabular-nums">{c.creditBalance}</p>
                    <p className="text-[11px] text-muted-foreground">minutes</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">
                    <span className="hidden sm:inline group-open:hidden">Manage</span>
                    <span className="hidden group-open:sm:inline">Close</span>
                    <ChevronDown className="size-4 transition-transform duration-200 group-open:rotate-180" />
                  </span>
                </div>
              </summary>

              <div className="animate-in fade-in slide-in-from-top-1 border-t border-border bg-muted/20 p-4 duration-200 sm:p-5">
                <div className="grid gap-6 md:grid-cols-3">
                  <Section title="Voice minutes">
                    <CreditAdjustForm businessId={c.businessId} balance={c.creditBalance} history={c.history} />
                  </Section>
                  <Section title="Billing & assistant">
                    <ClientStatusControls businessId={c.businessId} active={c.active} billingStatus={c.billingStatus} editable={c.editable} />
                    {whopReady && c.editable && !c.demo ? <PaymentLinkButton businessId={c.businessId} /> : null}
                  </Section>
                  <Section title="Manage">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/clients/${c.businessId}/edit`} className="btn btn-outline btn-sm">Manage client</Link>
                    </div>
                    {c.editable ? (
                      <div className="mt-3">
                        <DeleteButton
                          endpoint={`/api/admin/clients/${c.businessId}`}
                          label="Delete client"
                          typeToConfirm={c.businessId}
                          allowForce
                          warning={`Permanently deletes ${c.businessName}: their login, phone line, calls, minutes and leads. Payment records are kept.`}
                        />
                      </div>
                    ) : null}
                  </Section>
                </div>
              </div>
            </details>
          ))
        )}
      </div>

      {pendingLinks.length > 0 ? (
        <div className="mt-10">
          <h2 className="text-sm font-medium">Setup links waiting to be used</h2>
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-card text-sm">
            {pendingLinks.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span>
                  <span className="font-medium">{r.business_name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{r.client_email} · {r.services}{r.paid ? ' · marked paid' : ''} · expires {new Date(r.expires_at).toLocaleDateString()}</span>
                </span>
                <DeleteButton endpoint={`/api/admin/intakes/${r.id}`} label="Cancel link" warning="The link stops working. You can create a new one any time." />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Recent payments</h2>
          <Link href="/admin/sales" className="text-xs text-primary underline underline-offset-4">Open full sales view</Link>
        </div>
        <div className="mt-2 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Event</th>
                <th className="px-4 py-2 font-medium">Buyer</th>
                <th className="px-4 py-2 font-medium">Client</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-muted-foreground">
                    {process.env.WHOP_WEBHOOK_SECRET ? 'No Whop payments yet.' : 'Whop is not connected yet: add WHOP_WEBHOOK_SECRET in Vercel.'}
                  </td>
                </tr>
              ) : (
                payments.map((p, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 tabular-nums">{new Date(p.created_at).toLocaleString()}</td>
                    <td className="px-4 py-2">{String(p.type).replace('whop.', '')}</td>
                    <td className="px-4 py-2">{p.email ?? 'unknown'}</td>
                    <td className="px-4 py-2">{p.business_id ?? <span className="text-destructive">no match</span>}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {whopReady
          ? 'Payment links are created in Whop with the client attached; when they pay, billing turns active and minute packs are added automatically. Use the credit box only for manual corrections.'
          : 'Whop is not fully connected yet (WHOP_API_KEY missing), so minutes are added by hand here after you confirm a payment.'}
      </p>

      <div className="mt-10">
        <h2 className="text-sm font-medium">Tools</h2>
        <div className="mt-2 grid gap-6 sm:grid-cols-2">
          <CreateClientForm />
          <TestEmailButton defaultEmail={session.email} />
        </div>
      </div>
    </div>
  )
}
