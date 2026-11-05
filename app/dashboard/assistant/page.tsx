import Link from 'next/link'
import { getClientSession } from '@/lib/accounts/session'
import { getStoredBusiness } from '@/lib/config/business-store'
import { defaultPhoneGreeting } from '@/lib/config/greetings'
import { DashHeader } from '@/components/dash-header'
import { AssistantForm } from '@/components/settings/business-forms'

export const metadata = { title: 'Your assistant' }
export const dynamic = 'force-dynamic'

export default async function AssistantPage() {
  const session = (await getClientSession())!
  const stored = await getStoredBusiness(session.businessId!)
  const c = stored?.config
  if (!stored || !c) return null
  const squash = (s: string) => s.replace(/\s+/g, ' ').trim()
  const followsName = !c.voice.greeting || squash(c.voice.greeting) === squash(defaultPhoneGreeting(c.name, c.voice.assistantName))

  return (
    <div className="space-y-6">
      <DashHeader title="Your assistant" description="Choose its name, voice and personality, and how it greets people." />
      {stored.source === 'db' ? (
        <AssistantForm
          endpoint="/api/client/settings"
          businessName={c.name}
          initial={{ assistantName: c.voice.assistantName, tone: c.voice.tone, greeting: followsName ? '' : c.voice.greeting, voiceId: c.voice.voiceId ?? '' }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">These settings are managed for you. Use the request form on the &quot;What it knows&quot; page.</p>
      )}
      <div className="card p-5 text-sm">
        <p className="font-medium">More ways to shape it</p>
        <ul className="mt-2 space-y-1 text-muted-foreground">
          <li><Link href="/dashboard/knowledge" className="text-primary underline underline-offset-4">What it knows</Link>: the questions and answers it uses.</li>
          <li><Link href="/dashboard/business" className="text-primary underline underline-offset-4">Business info</Link>: your hours, services and prices.</li>
          <li><Link href="/dashboard/chat" className="text-primary underline underline-offset-4">Website chat</Link>: colours and the chat window&apos;s wording.</li>
        </ul>
      </div>
    </div>
  )
}
