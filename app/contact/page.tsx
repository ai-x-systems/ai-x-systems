import type { Metadata } from 'next'
import { Mail, MessageCircle } from 'lucide-react'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { siteConfig } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Contact',
  description: `Get in touch with ${siteConfig.brand.name} — book a free AI Receptionist demo or reach our support team.`,
}

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="mx-auto max-w-2xl px-4 md:px-6">
          <PageHeader
            eyebrow="Contact"
            title="Let's get your AI Receptionist set up."
            description="Most people start with a free demo — we'll build it around your business before you commit to anything. For anything else, reach us directly below."
          />

          <div className="mt-10 rounded-2xl border border-border bg-card/40 p-6">
            <h2 className="text-sm font-semibold">Interested in the AI Receptionist?</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Book a free personalized demo — no commitment required.
            </p>
            <div className="mt-4">
              <Button render={<a href={siteConfig.forms.demoPath} />}>Get a Free Demo</Button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <a
              href={`mailto:${siteConfig.contact.email}`}
              className="flex items-start gap-3 rounded-2xl border border-border bg-card/40 p-6 transition-colors hover:border-primary/40"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Mail className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold">General inquiries</p>
                <p className="mt-1 text-sm text-muted-foreground">{siteConfig.contact.email}</p>
              </div>
            </a>

            <a
              href={`mailto:${siteConfig.contact.supportEmail}`}
              className="flex items-start gap-3 rounded-2xl border border-border bg-card/40 p-6 transition-colors hover:border-primary/40"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageCircle className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold">Existing client support</p>
                <p className="mt-1 text-sm text-muted-foreground">{siteConfig.contact.supportEmail}</p>
              </div>
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
