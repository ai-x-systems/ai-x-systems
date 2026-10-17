import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/accounts/session'
import { getBusiness } from '@/lib/config/business-store'
import { getBusinessOverride } from '@/lib/config/overrides'
import { AppTopbar } from '@/components/app-topbar'
import { PageHeader } from '@/components/page-header'
import { EditBusinessConfigForm } from './edit-business-config-form'
import { AppearanceForm } from '@/components/appearance-form'
import { defaultChatGreeting, defaultBubble, defaultHeadline, defaultSubtitle, resolveSuggestions } from '@/lib/config/greetings'

export const metadata = { title: 'Edit business info' }

export default async function EditBusinessConfigPage({
  params,
}: {
  params: Promise<{ businessId: string }>
}) {
  const session = await getAdminSession()
  if (!session) redirect('/admin-login')

  const { businessId } = await params
  const business = await getBusiness(businessId)
  if (!business) redirect('/admin')

  const override = await getBusinessOverride(businessId)
  const faqs = override?.faqs ?? business.knowledge.faqs
  const notifyEmail = override?.notifyEmail ?? business.integrations.notifyEmail ?? ''

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-16 md:px-6">
      <AppTopbar current="admin" />
      <PageHeader
        eyebrow="Admin"
        title={`Edit ${business.name}`}
        description="FAQs, notification email and chat appearance. Everything else still lives in the business's JSON file."
      />
      <div className="mt-8">
        <EditBusinessConfigForm businessId={businessId} initialFaqs={faqs} initialNotifyEmail={notifyEmail} />
      </div>

      <div className="mt-12">
        <h2 className="text-lg font-semibold">Chat appearance</h2>
        <p className="mb-4 mt-1 text-xs text-muted-foreground">Colour, headline, first message and quick questions. Leave a field empty to use the default.</p>
        <AppearanceForm
          endpoint={`/api/admin/clients/${businessId}/appearance`}
          businessName={business.name}
          initial={{ ...(business.chat ?? {}), ...(override?.chat ?? {}) }}
          defaults={{
            greeting: defaultChatGreeting(business.name, business.voice.assistantName),
            bubble: defaultBubble(business.name),
            headline: defaultHeadline(business.name),
            subtitle: defaultSubtitle(business.voice.assistantName),
            suggestions: resolveSuggestions({ ...business, chat: undefined }),
          }}
        />
      </div>
    </main>
  )
}
