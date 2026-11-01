'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/leads', label: 'Leads' },
  { href: '/dashboard/integrations', label: 'Integrations' },
  { href: '/dashboard/chat', label: 'Website chat', chatOnly: true },
  { href: '/dashboard/knowledge', label: 'What it knows' },
  { href: '/dashboard/billing', label: 'Billing' },
  { href: '/dashboard/settings', label: 'Settings' },
]

export function ClientNav({ showChat }: { showChat: boolean }) {
  const path = usePathname()
  return (
    <nav className="mt-8 flex gap-1 overflow-x-auto border-b border-border" aria-label="Dashboard sections">
      {TABS.filter((t) => showChat || !t.chatOnly).map((t) => {
        const active = t.href === '/dashboard' ? path === '/dashboard' : path.startsWith(t.href)
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors ${active ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
