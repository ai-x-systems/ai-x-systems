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
    <nav className="mt-8 flex gap-1 overflow-x-auto rounded-xl border border-border bg-card/60 p-1 backdrop-blur" aria-label="Dashboard sections">
      {TABS.filter((t) => showChat || !t.chatOnly).map((t) => {
        const active = t.href === '/dashboard' ? path === '/dashboard' : path.startsWith(t.href)
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm transition-all ${active ? 'bg-primary/15 font-medium text-foreground shadow-[inset_0_0_0_1px] shadow-primary/40' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
