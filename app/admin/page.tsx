import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAdminSession } from '@/lib/accounts/session'
import { accountStore } from '@/lib/accounts/store'
import { listStoredBusinesses } from '@/lib/config/business-store'
import { creditLedger } from '@/lib/billing/credits'
import { PageHeader } from '@/components/page-header'
import { AppTopbar } from '@/components/app-topbar'
import { LogoutButton } from '@/app/dashboard/logout-button'
import { CreditAdjustForm } from './credit-adjust-form'
import { CreateClientForm } from './create-client-form'
import { TestEmailButton } from './test-email-button'
import { ClientStatusControls } from './client-status-controls'

export const metadata = { title: 'Admin' }

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
          active: sb?.active ?? true,
          billingStatus: sb?.billingStatus ?? 'active',
          editable: sb?.source === 'db',
        }
      })
  )

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-16 md:px-6">
      <AppTopbar current="admin" />
      <div className="flex items-start justify-between gap-4">
        <PageHeader eyebrow="Admin" title="Clients" description={`${clients.length} client account(s)`} />
        <div className="flex items-center gap-4">
          <Link href="/admin/onboard" className="text-sm font-medium text-primary underline underline-offset-4">
            + Onboard client
          </Link>
          <Link href="/admin/voice" className="text-sm text-primary underline underline-offset-4">
            Voice
          </Link>
          <Link href="/admin/growth" className="text-sm text-primary underline underline-offset-4">
            Growth
          </Link>
          <Link href="/admin/inquiries" className="text-sm text-primary underline underline-offset-4">
            Inquiries
          </Link>
          <LogoutButton role="admin" />
        </div>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <CreateClientForm />
        <TestEmailButton defaultEmail={session.email} />
      </div>

      <div className="mt-10 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Business</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Billing</th>
              <th className="px-4 py-3 font-medium">Minutes</th>
              <th className="px-4 py-3 font-medium">Record payment / usage</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  No client accounts yet.
                </td>
              </tr>
            ) : (
              clients.map((c) => (
                <tr key={c.accountId} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.businessName}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.businessId} · {c.industry}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        c.demo
                          ? 'rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground'
                          : 'rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary'
                      }
                    >
                      {c.demo ? 'Demo' : 'Live'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ClientStatusControls businessId={c.businessId} active={c.active} billingStatus={c.billingStatus} editable={c.editable} />
                    {!c.active ? <span className="mt-1 block text-xs text-destructive">assistant paused</span> : null}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{c.creditBalance}</td>
                  <td className="px-4 py-3">
                    <CreditAdjustForm businessId={c.businessId} />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/clients/${c.businessId}/edit`}
                      className="text-xs text-primary underline underline-offset-4"
                    >
                      Edit info
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Minutes (1 credit = 1 voice minute) are recorded manually here after you confirm a Payment Request Link
        (Elevate Pay / PingPong / Payoneer) was paid — nothing here charges a card automatically.
      </p>
    </main>
  )
}
