import { getClientSession } from '@/lib/accounts/session'
import { getStoredBusiness } from '@/lib/config/business-store'
import { getBusinessOverride } from '@/lib/config/overrides'
import { FaqEditor, ChangeRequestForm } from './knowledge-forms'

export const metadata = { title: 'What it knows' }
export const dynamic = 'force-dynamic'

export default async function KnowledgePage() {
  const session = (await getClientSession())!
  const stored = await getStoredBusiness(session.businessId!)
  const business = stored?.config
  if (!business) return null
  const override = await getBusinessOverride(session.businessId!)
  const faqs = override?.faqs ?? business.knowledge.faqs
  const editable = stored?.source === 'db'

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <p className="text-sm font-medium">Questions &amp; answers</p>
        <p className="mb-4 mt-1 text-xs text-muted-foreground">What your assistant tells customers, in chat and on the phone. Write answers the way you would say them.</p>
        {editable ? <FaqEditor initial={faqs.map((f) => ({ question: f.question, answer: f.answer }))} /> : <p className="text-sm text-muted-foreground">These are managed for you. Use the request form below.</p>}
      </div>

      <div className="card p-5">
        <p className="text-sm font-medium">Your services &amp; hours</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {business.knowledge.services.length ? `${business.knowledge.services.length} service(s) listed: ${business.knowledge.services.map((s) => s.name).join(', ')}.` : 'No services are listed yet.'}
        </p>
        <p className="mb-3 mt-3 text-xs text-muted-foreground">Hours, services, prices and policies are changed by us so booking keeps working correctly. Tell us what to change:</p>
        <ChangeRequestForm />
      </div>
    </div>
  )
}
