import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getStoredBusiness } from '@/lib/config/business-store'
import { getLineForBusiness } from '@/lib/voice/store'
import { isDemoId } from '@/lib/onboarding/build-config'
import { siteConfig } from '@/lib/site-config'

export const metadata: Metadata = { title: 'Preview', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function TryPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params
  // Only generated previews are ever shown here, never a real client.
  if (!isDemoId(businessId)) notFound()
  const stored = await getStoredBusiness(businessId)
  if (!stored || stored.source !== 'db' || !stored.config.demo) notFound()

  const name = stored.config.name
  // The shared demo phone line points at one preview at a time; only show it while it points here.
  const line = await getLineForBusiness(businessId).catch(() => null)
  const phone = line?.isDemoLine && line.enabled ? line.e164 : null
  const mail = `mailto:${siteConfig.contact.email}?subject=${encodeURIComponent(`Preview for ${name}`)}`

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-10">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview by {siteConfig.brand.name}</p>
      <h1 className="mt-2 text-2xl font-semibold">An AI receptionist for {name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Built only from what&apos;s public on your website. Ask it what a customer would: hours, services, how to book.
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-border" style={{ height: 560 }}>
        <iframe src={`/embed/chat/${businessId}`} title={`Chat preview for ${name}`} className="h-full w-full border-0" />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        This is a preview, so details may be incomplete. Anything you type here is visible to {siteConfig.brand.name}.
      </p>

      <div className="mt-8 rounded-xl border border-border bg-card p-5 text-sm">
        <p className="font-medium">Want the phone version too?</p>
        {phone ? (
          <p className="mt-1 text-muted-foreground">
            Call <a href={`tel:${phone}`} className="font-semibold text-primary underline underline-offset-4">{phone}</a> right now and hear it answer as {name}.
          </p>
        ) : (
          <p className="mt-1 text-muted-foreground">Reply to our email and we&apos;ll set up a live call so you can hear it answer as {name}.</p>
        )}
      </div>

      <div className="mt-6 text-sm">
        <p className="font-medium">If you like it</p>
        <p className="mt-1 text-muted-foreground">
          We put it on your website with your real hours, services and answers, send every enquiry to you, and you see everything in a dashboard.
        </p>
        <a href={mail} className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Get this on my site</a>
      </div>
    </main>
  )
}
