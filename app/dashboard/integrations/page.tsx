import { getClientSession } from '@/lib/accounts/session'
import { getStoredBusiness } from '@/lib/config/business-store'
import { getBusinessOverride } from '@/lib/config/overrides'
import { IntegrationsForm } from './integrations-form'

export const metadata = { title: 'Integrations' }
export const dynamic = 'force-dynamic'

function serviceAccountEmail(): string | undefined {
  try {
    const email = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '{}').client_email
    return typeof email === 'string' ? email : undefined
  } catch {
    return undefined
  }
}

export default async function IntegrationsPage() {
  const session = (await getClientSession())!
  const stored = await getStoredBusiness(session.businessId!)
  if (!stored || stored.source !== 'db') return <p className="text-sm text-muted-foreground">These settings are managed for you. Contact us to change them.</p>
  const i = stored.config.integrations
  const override = await getBusinessOverride(session.businessId!)

  return (
    <IntegrationsForm
      serviceEmail={serviceAccountEmail()}
      initial={{
        notifyEmail: override?.notifyEmail ?? i.notifyEmail ?? '',
        webhookUrl: i.webhookUrl ?? '',
        leadSheet: i.leadSheetId ?? '',
        leadSheetTabName: i.leadSheetTabName ?? '',
      }}
    />
  )
}
