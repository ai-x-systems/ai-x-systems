import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { getAdminSession } from '@/lib/accounts/session'
import { getStoredBusiness, installSnippet } from '@/lib/config/business-store'
import { getBusinessOverride } from '@/lib/config/overrides'
import { hoursToText, servicesToText } from '@/lib/config/hours-text'
import { defaultPhoneGreeting, defaultChatGreeting, defaultBubble, defaultHeadline, defaultSubtitle, resolveSuggestions } from '@/lib/config/greetings'
import { creditLedger } from '@/lib/billing/credits'
import { loadPaymentLines } from '@/lib/billing/sales-data'
import { whopConfigured } from '@/lib/billing/whop-checkout'
import { getLineForBusiness, listCalls } from '@/lib/voice/store'
import { listRecentActivity } from '@/lib/activity/log'
import { formatPhone, clockDuration } from '@/lib/voice/format'
import { DashHeader } from '@/components/dash-header'
import { AppearanceForm } from '@/components/appearance-form'
import { AssistantForm, DetailsForm, HoursForm, ServicesForm } from '@/components/settings/business-forms'
import { IntegrationsForm } from '@/app/dashboard/integrations/integrations-form'
import { ClientStatusControls } from '../../../client-status-controls'
import { CreditAdjustForm } from '../../../credit-adjust-form'
import { PaymentLinkButton } from '../../../payment-link-button'
import { DeleteButton } from '@/components/delete-button'
import { CopyField } from '@/components/copy-field'
import { RequestsPanel } from '../../../requests-panel'
import { ClientLineForm } from './client-line-form'
import { listRequests } from '@/lib/requests/store'
import { siteConfig } from '@/lib/site-config'
import { vapiConfigured, voiceWebhookUrl } from '@/lib/voice/vapi-api'
import { EditBusinessConfigForm } from './edit-business-config-form'

export const metadata = { title: 'Manage client' }
export const dynamic = 'force-dynamic'

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const date = (iso: string) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {hint ? <p className="mb-4 mt-1 text-sm text-muted-foreground">{hint}</p> : <div className="mb-4" />}
      <div className="space-y-4">{children}</div>
    </section>
  )
}

const SECTIONS = [
  ['overview', 'Overview'], ['assistant', 'Assistant'], ['business', 'Business info'], ['knowledge', 'Knowledge'], ['chat', 'Chat look'], ['chatcode', 'Chat code'],
  ['integrations', 'Integrations'], ['phone', 'Phone & calls'], ['billing', 'Billing'], ['leads', 'Leads'],
] as const

export default async function ManageClientPage({ params }: { params: Promise<{ businessId: string }> }) {
  const session = await getAdminSession()
  if (!session) redirect('/admin-login')
  const { businessId } = await params
  const stored = await getStoredBusiness(businessId)
  if (!stored) redirect('/admin')
  const c = stored.config
  const editable = stored.source === 'db'
  const api = `/api/admin/clients/${businessId}`

  const [override, balance, line, calls, allPayments, leads, requests] = await Promise.all([
    getBusinessOverride(businessId), creditLedger.getBalance(businessId), getLineForBusiness(businessId),
    listCalls(businessId, 10), loadPaymentLines(), listRecentActivity(businessId, 10), listRequests({ businessId }).catch(() => []),
  ])
  const origin = siteConfig.brand.baseUrl.replace(/\/+$/, '')
  const snippet = installSnippet(origin, businessId)
  const chatLink = `${origin}/embed/chat/${businessId}`
  const pendingRequests = requests.filter((r) => r.status === 'pending').map((r) => ({ ...r, businessName: c.name }))
  const payments = allPayments.filter((p) => p.businessId === businessId).reverse()
  const faqs = override?.faqs ?? c.knowledge.faqs
  const notifyEmail = override?.notifyEmail ?? c.integrations.notifyEmail ?? ''
  const squash = (s: string) => s.replace(/\s+/g, ' ').trim()
  const followsName = !c.voice.greeting || squash(c.voice.greeting) === squash(defaultPhoneGreeting(c.name, c.voice.assistantName))
  const bookingLocked = c.booking.enabled && c.booking.appointmentTypes.length > 0
  const serviceEmail = (() => { try { const e = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '{}').client_email; return typeof e === 'string' ? e : undefined } catch { return undefined } })()
  const chip = 'rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs'

  return (
    <div>
      <DashHeader
        title={`Manage ${c.name}`}
        description={`${businessId} · ${stored.clientEmail ?? 'no login email'} · everything the client can change, plus billing and minutes.`}
        actions={<><Link href="/admin" className="btn btn-outline btn-sm">All clients</Link><Link href="/admin/voice" className="btn btn-outline btn-sm">Voice</Link><Link href="/admin/sales" className="btn btn-outline btn-sm">Sales</Link></>}
      />

      <nav className="sticky top-14 z-20 -mx-4 mb-8 flex gap-1 overflow-x-auto border-b border-border bg-background/80 px-4 py-2 backdrop-blur-xl md:-mx-8 md:px-8" aria-label="Sections">
        {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">{label}</a>)}
      </nav>

      <div className="space-y-12">
        <Section id="overview" title="Overview">
          <RequestsPanel requests={pendingRequests} title="Open requests from this client" />
          <div className="card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={chip}>{c.demo ? 'Demo' : stored.active ? 'Live' : 'Paused'}</span>
              <span className={chip}>Billing: {stored.billingStatus.replace('_', ' ')}</span>
              <span className={chip}>Plan: {stored.services === 'both' ? 'Chat + voice' : stored.services === 'voice' ? 'Voice' : 'Website chat'}</span>
              <span className={chip}>{balance.balance} minutes left</span>
              {!editable ? <span className={chip}>Managed in code</span> : null}
            </div>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <ClientStatusControls businessId={businessId} active={stored.active} billingStatus={stored.billingStatus} editable={editable} />
              <div>
                <CreditAdjustForm businessId={businessId} balance={balance.balance} history={balance.transactions.slice(-8).reverse().map((t) => ({ id: t.id, amount: t.amount, type: t.type, note: t.note ?? '', at: t.createdAtISO }))} />
                {editable && whopConfigured() && !c.demo ? <PaymentLinkButton businessId={businessId} /> : null}
              </div>
            </div>
          </div>
        </Section>

        {editable ? (
          <>
            <Section id="assistant" title="Assistant" hint="Its name, voice, tone and how it greets callers. The client can change these too.">
              <AssistantForm endpoint={`${api}/settings`} businessName={c.name} initial={{ assistantName: c.voice.assistantName, tone: c.voice.tone, greeting: followsName ? '' : c.voice.greeting, voiceId: c.voice.voiceId ?? '' }} />
            </Section>

            <Section id="business" title="Business info" hint="Details, opening hours and services. The assistant answers from these.">
              <DetailsForm endpoint={`${api}/settings`} initial={{ name: c.name, phone: c.phoneNumber, address: c.contact.address ?? '', website: c.contact.website ?? '' }} />
              <HoursForm endpoint={`${api}/settings`} unknown={c.hoursKnown === false} initial={{ hoursText: c.hoursKnown === false ? '' : hoursToText(c.hours), timezone: c.timezone }} />
              <ServicesForm endpoint={`${api}/settings`} locked={bookingLocked} initial={{ servicesText: servicesToText(c.knowledge.services) }} />
            </Section>

            <Section id="knowledge" title="Knowledge" hint="Questions and answers, and the email that receives lead alerts.">
              <EditBusinessConfigForm businessId={businessId} initialFaqs={faqs} initialNotifyEmail={notifyEmail} />
            </Section>

            <Section id="chat" title="Chat look" hint="Colour, headline, first message and quick questions. Leave a field empty to use the default.">
              <div className="card p-5">
                <AppearanceForm
                  endpoint={`${api}/appearance`}
                  businessName={c.name}
                  initial={{ ...(c.chat ?? {}), ...(override?.chat ?? {}) }}
                  defaults={{ greeting: defaultChatGreeting(c.name, c.voice.assistantName), bubble: defaultBubble(c.name), headline: defaultHeadline(c.name), subtitle: defaultSubtitle(c.voice.assistantName), suggestions: resolveSuggestions({ ...c, chat: undefined }) }}
                />
              </div>
            </Section>

            <Section id="integrations" title="Integrations" hint="Where this client's leads go: alert email, CRM / automation webhook, Google Sheet.">
              <IntegrationsForm
                endpoint={`${api}/integrations`}
                serviceEmail={serviceEmail}
                initial={{ notifyEmail, webhookUrl: c.integrations.webhookUrl ?? '', leadSheet: c.integrations.leadSheetId ?? '', leadSheetTabName: c.integrations.leadSheetTabName ?? '' }}
              />
            </Section>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">This business lives in your code files (config/businesses), so its assistant, hours and services are edited there. Minutes, calls and payments below still work.</p>
        )}

        <Section id="chatcode" title="Website chat code" hint="Paste this one line on the client's website (before the closing body tag, or in the site builder's custom-code box), or send it to them.">
          <div className="card space-y-4 p-5">
            <CopyField value={snippet} multiline />
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Direct chat link (works without a website):</p>
              <CopyField value={chatLink} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a href={chatLink} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">Open chat preview</a>
              {stored.clientEmail ? (
                <a className="btn btn-outline btn-sm" href={`mailto:${stored.clientEmail}?subject=${encodeURIComponent(`Your AI chat for ${c.name}`)}&body=${encodeURIComponent(`Hi,\n\nTo add your AI chat assistant to your website, paste this line just before the closing </body> tag (or into your website builder's custom code / header box):\n\n${snippet}\n\nYou can also share this direct link: ${chatLink}\n\nIf you'd rather we do it, reply to this email or use the form in your dashboard.`)}`}>Email instructions to client</a>
              ) : null}
            </div>
            {requests.some((r) => r.kind === 'chat_install') ? <p className="text-xs text-muted-foreground">Install requests from this client: {requests.filter((r) => r.kind === 'chat_install').map((r) => `${r.status} (${new Date(r.createdAtISO).toLocaleDateString()})`).join(', ')}.</p> : null}
          </div>
        </Section>

        <Section id="phone" title="Phone & calls" hint="The line callers reach, and the last 10 calls.">
          <ClientLineForm
            businessId={businessId}
            hasLine={!!line}
            vapiReady={vapiConfigured()}
            serverUrl={voiceWebhookUrl()}
            initial={{ number: line?.e164 ?? '', forwardTo: line?.forwardTo ?? '', vapiPhoneNumberId: line?.vapiPhoneNumberId ?? '', sellCentsPerMinute: String(line?.sellCentsPerMinute ?? 25) }}
          />
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead><tr className="border-b border-border text-muted-foreground">{['When', 'Caller', 'Length', 'Minutes billed', 'Ended'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {calls.length === 0 ? <tr><td colSpan={5} className="px-3 py-5 text-center text-muted-foreground">No calls yet.</td></tr> : calls.map((k) => (
                  <tr key={k.callId} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{new Date(k.createdAtISO).toLocaleString()}</td>
                    <td className="px-3 py-2">{k.caller ? formatPhone(k.caller) : 'web / unknown'}</td>
                    <td className="px-3 py-2 tabular-nums">{clockDuration(k.durationSeconds)}</td>
                    <td className="px-3 py-2 tabular-nums">{k.billedMinutes}</td>
                    <td className="px-3 py-2 text-muted-foreground">{k.endedReason ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="billing" title="Billing & payments">
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead><tr className="border-b border-border text-muted-foreground">{['Date', 'What', 'Amount', 'Source'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {payments.length === 0 ? <tr><td colSpan={4} className="px-3 py-5 text-center text-muted-foreground">No payments recorded for this client. Record one on the <Link href="/admin/sales" className="text-primary underline underline-offset-4">Sales page</Link>.</td></tr> : payments.map((p, i) => (
                  <tr key={p.eventId ?? i} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{date(p.at)}</td><td className="px-3 py-2">{p.note}</td><td className="px-3 py-2 tabular-nums">{money(p.amount)}</td><td className="px-3 py-2">{p.manual ? 'manual' : 'Whop'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">To end their subscription, use <Link href="/admin/sales" className="text-primary underline underline-offset-4">Sales → By client</Link>.</p>
        </Section>

        <Section id="leads" title="Recent leads">
          <div className="card divide-y divide-border text-sm">
            {leads.length === 0 ? <p className="p-5 text-muted-foreground">No leads yet.</p> : leads.map((e) => {
              const d = e.data as Record<string, unknown>
              return (
                <div key={e.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <span><span className="font-medium">{e.type === 'booking' ? 'Booking' : 'Lead'}{typeof d.callerName === 'string' && d.callerName ? ` — ${d.callerName}` : ''}</span><span className="block text-muted-foreground">{(d.reason as string | undefined) ?? ''}</span></span>
                  <span className="shrink-0 text-xs text-muted-foreground">{new Date(e.createdAtISO).toLocaleDateString()}</span>
                </div>
              )
            })}
          </div>
        </Section>

        {editable ? (
          <div className="rounded-xl border border-destructive/30 p-5">
            <p className="text-sm font-medium">Danger zone</p>
            <p className="mb-3 mt-1 text-xs text-muted-foreground">Deleting removes their login, phone line, calls, minutes and leads for good. Payment records are kept.</p>
            <DeleteButton endpoint={`${api}`} label="Delete this client" typeToConfirm={businessId} allowForce warning={`Permanently deletes ${c.name}. Cancel their subscription first if they are still paying.`} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
