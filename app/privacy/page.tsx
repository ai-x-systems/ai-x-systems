import type { Metadata } from 'next'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { PageHeader } from '@/components/page-header'
import { siteConfig } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `How ${siteConfig.brand.name} collects, uses, and protects information.`,
  robots: { index: false },
}

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="mx-auto max-w-2xl px-4 md:px-6">
          <PageHeader eyebrow="Legal" title="Privacy Policy" />

          <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Draft placeholder.</strong> This is starting
            content, not legal advice. Have a lawyer review and finalize this before launch —
            especially given clients in regulated industries (medical, legal) and the use of
            calling/SMS, which carry their own compliance requirements (e.g. HIPAA-adjacent
            handling of patient information, TCPA rules for calls and texts).
          </div>

          <div className="mt-10 text-sm [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-tight [&_li]:mt-1.5 [&_li]:leading-relaxed [&_li]:text-muted-foreground [&_p]:mt-2 [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-primary [&_a]:underline">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Last updated: [date]
            </p>

            <h2>Overview</h2>
            <p>
              {siteConfig.brand.name} (&quot;we&quot;, &quot;us&quot;) provides AI Receptionist
              services to businesses (&quot;clients&quot;). This policy explains what information
              we collect through our website and services, how we use it, and the choices
              available to you.
            </p>

            <h2>Information we collect</h2>
            <ul>
              <li>
                <strong>Website visitors:</strong> information submitted through our demo request
                form (name, business name, phone, email, and details about your business).
              </li>
              <li>
                <strong>Client end-customers:</strong> when a client deploys an AI Receptionist,
                it may process caller/visitor information (name, contact details, appointment
                requests, and conversation content) on the client&apos;s behalf.
              </li>
              <li>
                <strong>Usage data:</strong> standard analytics data (pages visited, device type)
                collected via our hosting/analytics provider.
              </li>
            </ul>

            <h2>How we use information</h2>
            <ul>
              <li>To respond to demo requests and build personalized demos.</li>
              <li>To operate, maintain, and improve the AI Receptionist service for clients.</li>
              <li>To send service-related communications (setup updates, support).</li>
            </ul>

            <h2>Data processed on behalf of clients</h2>
            <p>
              When acting as a service provider to our clients, we process end-customer data (call
              and chat transcripts, appointment details, contact information) only as instructed by
              the client, and only to deliver the AI Receptionist service. A separate data
              processing agreement is available for clients on request.
            </p>

            <h2>Sharing</h2>
            <p>
              We share information with the infrastructure and AI providers that power the service
              (e.g. voice processing, language models, calendar, and notification providers), and
              do not sell personal information.
            </p>

            <h2>Your choices</h2>
            <p>
              You can request access to, correction of, or deletion of your information by
              contacting us at{' '}
              <a href={`mailto:${siteConfig.contact.email}`}>{siteConfig.contact.email}</a>.
            </p>

            <h2>Contact</h2>
            <p>
              Questions about this policy can be sent to{' '}
              <a href={`mailto:${siteConfig.contact.email}`}>{siteConfig.contact.email}</a>.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
