import { redirect } from 'next/navigation'
import { getClientSession } from '@/lib/accounts/session'
import { getStoredBusiness } from '@/lib/config/business-store'
import { AppTopbar } from '@/components/app-topbar'
import { ClientNav } from '@/components/client-nav'
import { LogoutButton } from './logout-button'

export const metadata = { title: 'Dashboard' }

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getClientSession()
  if (!session?.businessId) redirect('/client/login')
  const stored = await getStoredBusiness(session.businessId)
  const showChat = (stored?.services ?? 'both') !== 'voice'
  const name = stored?.config.name ?? 'Your business'
  const live = stored ? stored.active && !stored.config.demo : false

  return (
    <div className="app-glow">
      <main className="mx-auto min-h-screen max-w-4xl px-4 py-16 md:px-6">
        <AppTopbar current="client" />
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-cyan-400 text-lg font-semibold text-white shadow-lg shadow-primary/30">
              {name.trim().charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Welcome back</p>
              <h1 className="truncate text-2xl font-semibold tracking-tight">{name}</h1>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span className={`inline-block h-2 w-2 rounded-full ${live ? 'bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/70' : 'bg-amber-400'}`} />
                {live ? 'Your receptionist is live' : stored && !stored.active ? 'Your receptionist is paused' : 'Demo mode'} · {session.email}
              </p>
            </div>
          </div>
          <LogoutButton role="client" />
        </div>
        <ClientNav showChat={showChat} />
        <div className="mt-8 animate-in fade-in slide-in-from-bottom-2 duration-300">{children}</div>
      </main>
    </div>
  )
}
