import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAdminSession } from '@/lib/accounts/session'
import { listProspects } from '@/lib/leads/prospects'
import { AppTopbar } from '@/components/app-topbar'
import { PageHeader } from '@/components/page-header'
import { ProspectStatusSelect } from './prospect-status-select'
import { DeleteButton } from '@/components/delete-button'

export const metadata = { title: 'Inquiries' }

const SERVICE_LABELS: Record<string, string> = {
  voice: 'Voice Receptionist',
  chatbot: 'Website Chatbot',
  both: 'Voice + Chatbot',
}

export default async function InquiriesPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin-login')

  const prospects = await listProspects()

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-16 md:px-6">
      <AppTopbar current="admin" />
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          eyebrow="Admin"
          title="Inquiries"
          description={`${prospects.length} submission(s) from the demo request form`}
        />
        <Link href="/admin" className="text-sm text-primary underline underline-offset-4">
          Back to Clients
        </Link>
      </div>

      <div className="mt-10 space-y-4">
        {prospects.length === 0 ? (
          <div className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
            No inquiries yet.
          </div>
        ) : (
          prospects.map((p) => (
            <div key={p.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{p.businessName}</p>
                    {p.serviceType ? (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                        {SERVICE_LABELS[p.serviceType] ?? p.serviceType}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[p.industry, p.city, p.country].filter(Boolean).join(' · ') || '—'}
                  </p>
                  {p.website ? (
                    <a href={p.website.startsWith('http') ? p.website : `https://${p.website}`} target="_blank" rel="noreferrer" className="text-xs text-primary underline underline-offset-4">{p.website}</a>
                  ) : null}
                </div>
                <div className="text-right">
                  <ProspectStatusSelect prospectId={p.id} currentStatus={p.status} />
                  <div className="mt-1 flex justify-end"><DeleteButton endpoint={`/api/admin/prospects/${p.id}`} label="Delete" warning="Deletes this inquiry permanently." /></div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(p.createdAtISO).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Contact</p>
                  <p>{p.contactName}</p>
                  <a href={`mailto:${p.email}`} className="text-xs text-primary underline underline-offset-4">{p.email}</a>
                  {p.phone ? <p className="text-xs text-muted-foreground">{p.phone}</p> : null}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Business hours</p>
                  <p>{p.businessHours ?? '—'}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Volume</p>
                  <p>{p.volume ?? '—'}</p>
                </div>
              </div>

              {p.offerings ? (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">Services/products offered</p>
                  <p className="text-sm">{p.offerings}</p>
                </div>
              ) : null}

              {p.challenges ? (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">What they want the AI to solve</p>
                  <p className="text-sm">{p.challenges}</p>
                </div>
              ) : null}

              {p.details ? (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">Additional notes</p>
                  <p className="text-sm">{p.details}</p>
                </div>
              ) : null}

              {p.referralSource ? (
                <p className="mt-4 text-xs text-muted-foreground">Heard about us via: {p.referralSource}</p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </main>
  )
}
