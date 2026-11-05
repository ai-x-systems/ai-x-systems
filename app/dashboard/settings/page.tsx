import { getClientSession } from '@/lib/accounts/session'
import { getStoredBusiness } from '@/lib/config/business-store'
import { PauseControl, PasswordForm, DeleteAccountRequest } from './settings-forms'
import { DashHeader } from '@/components/dash-header'

export const metadata = { title: 'Settings' }
export const dynamic = 'force-dynamic'

const card = 'card p-5'

export default async function SettingsPage() {
  const session = (await getClientSession())!
  const stored = await getStoredBusiness(session.businessId!)
  const business = stored?.config
  if (!business || !stored) return null
  const editable = stored.source === 'db'

  return (
    <div className="space-y-6">
      <DashHeader title="Settings" description="Your login, assistant on/off, and your data." />
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
