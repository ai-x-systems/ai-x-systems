import type { Metadata } from 'next'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { PageHeader } from '@/components/page-header'
import { siteConfig, getTallyEmbedUrl } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Get Your Free AI Receptionist Demo',
  description:
    'Tell us about your business and we will build a personalized AI Receptionist demo — trained on your services, hours, and booking flow.',
}

export default function DemoPage() {
  return (
    <>
      <Navbar />
      <main className="pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="mx-auto max-w-2xl px-4 md:px-6">
          <PageHeader
            eyebrow="Free demo"
            title="Get a Free AI Receptionist Demo for Your Business"
            description={
              <>
                Tell us a bit about your business below. We&apos;ll build a personalized demo
                trained on your services, hours, and booking flow, then send it to you before we
                talk pricing.
              </>
            }
          />

          <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-card/60">
            <iframe
              title={`${siteConfig.brand.name} discovery form`}
              src={getTallyEmbedUrl()}
              width="100%"
              height="700"
              className="block w-full"
              loading="lazy"
            />
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Prefer email?{' '}
            <a href={`mailto:${siteConfig.contact.email}`} className="underline hover:text-foreground">
              {siteConfig.contact.email}
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
