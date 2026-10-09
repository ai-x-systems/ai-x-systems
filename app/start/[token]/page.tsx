import type { Metadata } from 'next'
import { getSupabaseClient } from '@/lib/supabase/client'
import { hashIntakeToken, intakeIsUsable, looksLikeIntakeToken } from '@/lib/onboarding/intake-token'
import { siteConfig } from '@/lib/site-config'
import { IntakeForm } from './intake-form'

export const metadata: Metadata = { title: 'Set up your AI receptionist', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

interface IntakeRow {
  status: string; expires_at: string; business_name: string; client_email: string; services: string
  website?: string | null; draft?: Record<string, string | undefined> | null
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-24 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{body}</p>
      <a href={`mailto:${siteConfig.contact.email}`} className="mt-6 inline-block text-sm text-primary underline underline-offset-4">Contact us</a>
    </main>
  )
}

export default async function StartPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!looksLikeIntakeToken(token)) return <Notice title="This link isn't valid" body="Please use the link we sent you, or ask us for a new one." />

  let row: IntakeRow | null = null
  try {
    const { data } = await getSupabaseClient().from('client_intakes').select('*').eq('token_hash', hashIntakeToken(token)).maybeSingle()
    row = data as IntakeRow | null
  } catch {
    return <Notice title="Something went wrong" body="Please try again in a minute." />
  }
  if (!intakeIsUsable(row)) return <Notice title="This link has expired or was already used" body="Ask us and we'll send you a fresh one." />

  const d = row!.draft ?? {}
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-12">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{siteConfig.brand.name}</p>
      <h1 className="mt-2 text-2xl font-semibold">Set up your AI receptionist</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        For <b>{row!.business_name}</b>. This takes about five minutes. Whatever you enter here is what your assistant will tell customers, so please check every detail.
      </p>
      <div className="mt-8">
        <IntakeForm
          token={token}
          services={row!.services}
          loginEmail={row!.client_email}
          initial={{
            industry: d.industry ?? '', website: row!.website ?? '', phone: d.phone ?? '', address: d.address ?? '',
            hoursText: d.hoursText ?? '', servicesText: d.servicesText ?? '', faqsText: d.faqsText ?? '', policiesText: d.policiesText ?? '',
            notifyEmail: row!.client_email,
          }}
          prefilled={!!d.hoursText || !!d.servicesText || !!d.faqsText}
        />
      </div>
    </main>
  )
}
