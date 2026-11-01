import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/accounts/session'
import { listProspects } from '@/lib/leads/prospects'
import { AppShell, type NavGroup } from '@/components/app-shell'
import { LogoutButton } from '@/app/dashboard/logout-button'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession()
  if (!session) redirect('/admin-login')
  const newInquiries = await listProspects().then((p) => p.filter((x) => x.status === 'new').length).catch(() => 0)

  const groups: NavGroup[] = [
    {
      label: 'Business',
      items: [
        { href: '/admin', label: 'Clients', icon: 'clients', exact: true },
        { href: '/admin/onboard', label: 'Onboard a client', icon: 'onboard' },
        { href: '/admin/sales', label: 'Sales', icon: 'sales' },
      ],
    },
    {
      label: 'Operations',
      items: [
        { href: '/admin/voice', label: 'Voice', icon: 'voice' },
        { href: '/admin/growth', label: 'Growth', icon: 'growth' },
        { href: '/admin/inquiries', label: 'Inquiries', icon: 'inbox', badge: newInquiries || undefined },
      ],
    },
  ]

  return (
    <AppShell
      portal="Admin"
      groups={groups}
      user={{ name: 'Admin', sub: session.email }}
      footerLinks={[{ href: '/', label: 'Main site' }, { href: '/client/login', label: 'Client login' }]}
      logout={<LogoutButton role="admin" />}
      topRight={<Link href="/admin/onboard" className="btn btn-primary btn-sm">+ Onboard client</Link>}
    >
      {children}
    </AppShell>
  )
}
