import Link from 'next/link'
import { AtSign, Mail } from 'lucide-react'
import { siteConfig } from '@/lib/site-config'

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 py-10 md:flex-row md:px-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/icon-mark.svg" alt="" width={24} height={24} className="rounded-md" />
          {siteConfig.brand.name}
        </Link>

        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <a
            href={`mailto:${siteConfig.contact.email}`}
            className="flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <Mail className="size-3.5" aria-hidden="true" />
            {siteConfig.contact.email}
          </a>
          <a
            href={siteConfig.social.instagram.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <AtSign className="size-3.5" aria-hidden="true" />
            {siteConfig.social.instagram.handle}
          </a>
        </div>

        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          {siteConfig.nav.footer.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        {`© ${new Date().getFullYear()} ${siteConfig.brand.legalName}. All rights reserved.`}
      </div>
    </footer>
  )
}
