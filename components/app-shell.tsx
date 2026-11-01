'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import {
  BarChart3, BookOpen, CreditCard, Inbox, LayoutDashboard, ListChecks, Menu, MessageSquare,
  Phone, Plug, Rocket, Settings, UserPlus, Users, X, ExternalLink,
} from 'lucide-react'

/**
 * The layout every dashboard uses: a left sidebar on desktop and a slide-out menu on phones,
 * with a slim top bar that shows where you are. Same shell for the admin and the client portal.
 */

const ICONS = {
  overview: LayoutDashboard, clients: Users, onboard: UserPlus, sales: BarChart3, voice: Phone, growth: Rocket,
  inbox: Inbox, leads: ListChecks, integrations: Plug, chat: MessageSquare, knowledge: BookOpen, billing: CreditCard, settings: Settings,
} as const
export type IconName = keyof typeof ICONS

export type NavItem = { href: string; label: string; icon: IconName; badge?: number; exact?: boolean }
export type NavGroup = { label?: string; items: NavItem[] }

export type ShellProps = {
  portal: string // small label under the brand: "Admin" or "Client portal"
  groups: NavGroup[]
  user: { name: string; sub?: string; status?: 'live' | 'paused' | 'demo' }
  footerLinks?: { href: string; label: string }[]
  logout: ReactNode
  topRight?: ReactNode
  maxWidth?: string
  children: ReactNode
}

function isActive(path: string, item: NavItem) {
  if (item.exact) return path === item.href
  return path === item.href || path.startsWith(`${item.href}/`)
}

function Sidebar({ portal, groups, user, footerLinks, logout, path, onNavigate }: Omit<ShellProps, 'children' | 'topRight' | 'maxWidth'> & { path: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pb-4 pt-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/icon-mark.svg" alt="" width={32} height={32} className="rounded-lg shadow-lg shadow-primary/25" />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold tracking-tight">AI x Systems</p>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{portal}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2" aria-label="Main">
        {groups.map((g, gi) => (
          <div key={gi}>
            {g.label ? <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">{g.label}</p> : null}
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const Icon = ICONS[item.icon]
                const active = isActive(path, item)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
                        active ? 'bg-primary/15 font-medium text-foreground shadow-[inset_0_0_0_1px] shadow-primary/30' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                      }`}
                    >
                      {active ? <span aria-hidden className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" /> : null}
                      <Icon className={`size-[18px] shrink-0 transition-transform group-hover:scale-110 ${active ? 'text-primary' : ''}`} />
                      <span className="truncate">{item.label}</span>
                      {item.badge ? <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold leading-none text-primary-foreground">{item.badge}</span> : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-3 border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-cyan-400 text-sm font-semibold text-white">
            {user.name.trim().charAt(0).toUpperCase() || '?'}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
              {user.status ? <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${user.status === 'live' ? 'bg-emerald-400' : 'bg-amber-400'}`} /> : null}
              <span className="truncate">{user.sub ?? (user.status === 'live' ? 'Live' : user.status === 'paused' ? 'Paused' : '')}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {footerLinks?.map((l) => (
              <Link key={l.href} href={l.href} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">{l.label}<ExternalLink className="size-3" /></Link>
            ))}
          </div>
          {logout}
        </div>
      </div>
    </div>
  )
}

export function AppShell({ children, topRight, maxWidth = 'max-w-6xl', ...side }: ShellProps) {
  const path = usePathname()
  const [open, setOpen] = useState(false)

  // Close the phone menu when you go somewhere, press Escape, or when the screen grows.
  useEffect(() => setOpen(false), [path])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open])

  const current = side.groups.flatMap((g) => g.items).find((i) => isActive(path, i))

  return (
    <div className="app-glow min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border bg-card/70 backdrop-blur-xl lg:block">
        <Sidebar {...side} path={path} />
      </aside>

      {/* Phone menu */}
      <div className={`fixed inset-0 z-50 lg:hidden ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
        <button type="button" aria-label="Close menu" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} />
        <div role="dialog" aria-modal="true" aria-label="Menu" className={`absolute inset-y-0 left-0 w-[19rem] max-w-[85vw] border-r border-border bg-card shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-x-0' : '-translate-x-full'}`}>
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute right-3 top-4 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-5" /></button>
          <Sidebar {...side} path={path} onNavigate={() => setOpen(false)} />
        </div>
      </div>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/70 px-4 backdrop-blur-xl md:px-8">
          <button type="button" aria-label="Open menu" onClick={() => setOpen(true)} className="-ml-2 rounded-lg p-2 text-foreground hover:bg-muted lg:hidden"><Menu className="size-5" /></button>
          <p className="truncate text-sm font-medium">{current?.label ?? side.portal}</p>
          <div className="ml-auto flex items-center gap-2">{topRight}</div>
        </header>
        <main className={`mx-auto w-full ${maxWidth} px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-8 md:py-8`}>
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">{children}</div>
        </main>
      </div>
    </div>
  )
}
