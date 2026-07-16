import type { Metadata } from 'next'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { PageHeader } from '@/components/page-header'
import { siteConfig } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: `The terms that govern use of ${siteConfig.brand.name}'s website and services.`,
  robots: { index: false },
}

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="mx-auto max-w-2xl px-4 md:px-6">
          <PageHeader eyebrow="Legal" title="Terms of Service" />

          <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Draft placeholder.</strong> This is starting
            content, not legal advice. Have a lawyer review and finalize this before launch —
            in particular the liability, service-level, and cancellation terms once your setup fee
            and subscription pricing are finalized.
          </div>

          <div className="mt-10 text-sm [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-tight [&_li]:mt-1.5 [&_li]:leading-relaxed [&_li]:text-muted-foreground [&_p]:mt-2 [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-primary [&_a]:underline">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Last updated: [date]
            </p>

            <h2>Agreement to terms</h2>
            <p>
              By using the {siteConfig.brand.name} website or services, you agree to these terms.
              If you don&apos;t agree, please don&apos;t use the site or services.
            </p>

            <h2>Our services</h2>
            <p>
              {siteConfig.brand.name} designs, configures, and deploys AI Receptionist services for
              businesses, covering phone and website channels. Specific scope, setup fees, and
              monthly subscription terms for a given client are set out in that client&apos;s
              service agreement, which takes precedence over this general policy where the two
              conflict.
            </p>

            <h2>Demos</h2>
            <p>
              Requesting a free demo does not create a binding agreement. Pricing and setup are
              discussed and agreed separately before any paid engagement begins.
            </p>

            <h2>Acceptable use</h2>
            <p>
              You agree not to use the service to send unlawful, harassing, or fraudulent
              communications, and to comply with applicable laws governing calls, texts, and
              customer data in your jurisdiction and industry.
            </p>

            <h2>Availability</h2>
            <p>
              We aim for high availability but do not guarantee uninterrupted service. Planned
              maintenance and service levels for paying clients are described in the client service
              agreement.
            </p>

            <h2>Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, {siteConfig.brand.name} is not liable for
              indirect, incidental, or consequential damages arising from use of the website or
              services.
            </p>

            <h2>Changes</h2>
            <p>
              We may update these terms from time to time. Continued use of the service after
              changes take effect constitutes acceptance of the updated terms.
            </p>

            <h2>Contact</h2>
            <p>
              Questions about these terms can be sent to{' '}
              <a href={`mailto:${siteConfig.contact.email}`}>{siteConfig.contact.email}</a>.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
