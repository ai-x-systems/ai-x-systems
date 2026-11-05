import { getClientSession } from '@/lib/accounts/session'
import { getStoredBusiness } from '@/lib/config/business-store'
import { hoursToText, servicesToText } from '@/lib/config/hours-text'
import { DashHeader } from '@/components/dash-header'
import { DetailsForm, HoursForm, ServicesForm } from '@/components/settings/business-forms'

export const metadata = { title: 'Business info' }
export const dynamic = 'force-dynamic'

export default async function BusinessPage() {
  const session = (await getClientSession())!
  const stored = await getStoredBusiness(session.businessId!)
  const c = stored?.config
  if (!stored || !c) return null
  if (stored.source !== 'db') return <p className="text-sm text-muted-foreground">These details are managed for you.</p>
  const endpoint = '/api/client/settings'
  const bookingLocked = c.booking.enabled && c.booking.appointmentTypes.length > 0

  return (
    <div className="space-y-6">
      <DashHeader title="Business info" description="Your details, opening hours and services. Your assistant answers from these." />
      <DetailsForm endpoint={endpoint} initial={{ name: c.name, phone: c.phoneNumber, address: c.contact.address ?? '', website: c.contact.website ?? '' }} />
      <HoursForm endpoint={endpoint} unknown={c.hoursKnown === false} initial={{ hoursText: c.hoursKnown === false ? '' : hoursToText(c.hours), timezone: c.timezone }} />
      <ServicesForm endpoint={endpoint} locked={bookingLocked} initial={{ servicesText: servicesToText(c.knowledge.services) }} />
    </div>
  )
}
