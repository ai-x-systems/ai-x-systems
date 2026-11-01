import { getClientSession } from '@/lib/accounts/session'
import { getStoredBusiness } from '@/lib/config/business-store'
import { getLineForBusiness } from '@/lib/voice/store'
import { ProfileForm, PauseControl, PasswordForm, DeleteAccountRequest } from './settings-forms'

export const metadata = { title: 'Settings' }
export const dynamic = 'force-dynamic'

const card = 'card p-5'

export default async function SettingsPage() {
  const session = (await getClientSession())!
  const stored = await getStoredBusiness(session.businessId!)
  const business = stored?.config
  const line = await getLineForBusiness(session.businessId!)
  if (!business || !stored) return null
  const editable = stored.source === 'db'

  return (
    <div className="space-y-6">
      {line ? (
        <div className={card}>
          <p className="text-sm font-medium">Your AI phone line</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{line.e164}</p>
          <p className="mt-1 text-xs text-muted-foreground">Ask your phone provider to forward unanswered or after-hours calls to this number, or give it out directly.{line.forwardTo ? ` When minutes run out, calls go to ${line.forwardTo}.` : ''}</p>
        </div>
      ) : null}

      <div className={card}>
        <p className="text-sm font-medium">Business details</p>
        <p className="mb-3 mt-1 text-xs text-muted-foreground">Used in what the assistant says about you.</p>
        {editable ? (
          <ProfileForm initial={{ name: business.name, phone: business.phoneNumber ?? '', address: business.contact.address ?? '', website: business.contact.website ?? '' }} />
        ) : <p className="text-sm text-muted-foreground">These details are managed for you.</p>}
      </div>

      {editable ? (
        <div className={card}>
          <p className="text-sm font-medium">Assistant on / off</p>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">{stored.active ? 'Your assistant is answering chats and calls.' : 'Your assistant is paused and is not answering.'}</p>
          <PauseControl active={stored.active} />
        </div>
      ) : null}

      <div className={card}>
        <p className="text-sm font-medium">Login</p>
        <p className="mb-3 mt-1 text-xs text-muted-foreground">You sign in as {session.email}.</p>
        <PasswordForm />
      </div>

      {editable ? (
        <div className={card}>
          <p className="text-sm font-medium">Your data</p>
          <p className="mb-3 mt-1 text-xs text-muted-foreground"><a href="/api/client/leads" className="text-primary underline underline-offset-4">Download all your leads (CSV)</a></p>
          <DeleteAccountRequest />
        </div>
      ) : null}
    </div>
  )
}
