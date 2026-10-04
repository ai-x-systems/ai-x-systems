import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/accounts/session'
import { getBusiness } from '@/lib/config/business-store'
import { getBusinessOverride } from '@/lib/config/overrides'
import { AppTopbar } from '@/components/app-topbar'
import { PageHeader } from '@/components/page-header'
import { EditBusinessConfigForm } from './edit-business-config-form'

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
        description="FAQs and notification email only — everything else still lives in the business's JSON file."
      />
      <div className="mt-8">
        <EditBusinessConfigForm businessId={businessId} initialFaqs={faqs} initialNotifyEmail={notifyEmail} />
      </div>
    </main>
  )
}
