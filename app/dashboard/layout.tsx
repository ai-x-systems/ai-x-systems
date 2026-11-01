import { redirect } from 'next/navigation'
import { getClientSession } from '@/lib/accounts/session'
import { getStoredBusiness } from '@/lib/config/business-store'
import { AppTopbar } from '@/components/app-topbar'
import { PageHeader } from '@/components/page-header'
import { ClientNav } from '@/components/client-nav'
import { LogoutButton } from './logout-button'

export const metadata = { title: 'Dashboard' }

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getClientSession()
  if (!session?.businessId) redirect('/client/login')
  const stored = await getStoredBusiness(session.businessId)
  const showChat = (stored?.services ?? 'both') !== 'voice'

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-16 md:px-6">
      <AppTopbar current="client" />
      <div className="flex items-start justify-between gap-4">
        <PageHeader eyebrow={stored?.config.name} title="Dashboard" description={session.email} />
        <LogoutButton role="client" />
      </div>
      <ClientNav showChat={showChat} />
      <div className="mt-8">{children}</div>
    </main>
  )
}
