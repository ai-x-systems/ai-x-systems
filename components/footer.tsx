import Link from 'next/link'
import { AtSign, Mail } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 py-10 md:flex-row md:px-6">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-[10px] font-bold">
            AI
          </span>
          AI x Systems
        </div>

        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <a
            href="mailto:hello@aixsystems.com"
            className="flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <Mail className="size-3.5" aria-hidden="true" />
            hello@aixsystems.com
          </a>
          <a
            href="https://instagram.com/aixsautomation"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <AtSign className="size-3.5" aria-hidden="true" />
            @aixsautomation
          </a>
        </div>

        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="#" className="transition-colors hover:text-foreground">
            Privacy
          </Link>
          <Link href="#" className="transition-colors hover:text-foreground">
            Terms
          </Link>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        {`© ${new Date().getFullYear()} AI x Systems. All rights reserved.`}
      </div>
    </footer>
  )
}
