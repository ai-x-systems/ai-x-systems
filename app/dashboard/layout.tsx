import { redirect } from 'next/navigation'
import { getClientSession } from '@/lib/accounts/session'
import { getStoredBusiness } from '@/lib/config/business-store'
import { getLineForBusiness } from '@/lib/voice/store'
import { AppShell, type NavGroup } from '@/components/app-shell'
import { LogoutButton } from './logout-button'

export const metadata = { title: 'Dashboard' }

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getClientSession()
  if (!session?.businessId) redirect('/client/login')
  const stored = await getStoredBusiness(session.businessId)
  const showChat = (stored?.services ?? 'both') !== 'voice'
  const name = stored?.config.name ?? 'Your business'
  const status = !stored || stored.config.demo ? 'demo' : stored.active ? 'live' : 'paused'

  const line = await getLineForBusiness(session.businessId)
  const showPhone = (stored?.services ?? 'both') !== 'chat' || !!line

  const groups: NavGroup[] = [
    {
      label: 'Workspace',
      items: [
        { href: '/dashboard', label: 'Overview', icon: 'overview', exact: true },
        { href: '/dashboard/leads', label: 'Leads', icon: 'leads' },
      ],
    },
    {
      label: 'Your assistant',
      items: [
        { href: '/dashboard/assistant', label: 'Assistant', icon: 'assistant' },
        { href: '/dashboard/business', label: 'Business info', icon: 'business' },
        { href: '/dashboard/knowledge', label: 'What it knows', icon: 'knowledge' },
      ],
    },
    {
      label: 'Channels',
      items: [
        ...(showChat ? [{ href: '/dashboard/chat', label: 'Website chat', icon: 'chat' as const }] : []),
        ...(showPhone ? [{ href: '/dashboard/phone', label: 'Phone line', icon: 'voice' as const }] : []),
        { href: '/dashboard/integrations', label: 'Integrations', icon: 'integrations' },
      ],
    },
    {
      label: 'Account',
      items: [
        { href: '/dashboard/billing', label: 'Billing', icon: 'billing' },
        { href: '/dashboard/settings', label: 'Settings', icon: 'settings' },
      ],
    },
  ]

  const pill =
    status === 'live' ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300' : status === 'paused' ? 'border-amber-400/40 bg-amber-400/10 text-amber-300' : 'border-border bg-muted/40 text-muted-foreground'

  return (
    <AppShell
      portal="Client portal"
      groups={groups}
      user={{ name, sub: session.email, status }}
      footerLinks={[{ href: '/', label: 'Main site' }]}
      logout={<LogoutButton role="client" />}
      maxWidth="max-w-5xl"
      topRight={
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${pill}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${status === 'live' ? 'bg-emerald-400' : status === 'paused' ? 'bg-amber-400' : 'bg-muted-foreground'}`} />
          {status === 'live' ? 'Receptionist live' : status === 'paused' ? 'Receptionist paused' : 'Demo mode'}
        </span>
      }
    >
      {children}
    </AppShell>
  )
}
