import { redirect } from 'next/navigation'
import { getClientSession } from '@/lib/accounts/session'
import { getStoredBusiness, installSnippet } from '@/lib/config/business-store'
import { getBusinessOverride } from '@/lib/config/overrides'
import { siteConfig } from '@/lib/site-config'
import { AppearanceForm } from '@/components/appearance-form'
import { CopyField } from '@/components/copy-field'
import { defaultBubble, defaultChatGreeting, defaultHeadline, defaultSubtitle, resolveSuggestions } from '@/lib/config/greetings'

export const metadata = { title: 'Website chat' }
export const dynamic = 'force-dynamic'

export default async function ChatPage() {
  const session = (await getClientSession())!
  const id = session.businessId!
  const stored = await getStoredBusiness(id)
  const business = stored?.config
  if (!business || stored?.services === 'voice') redirect('/dashboard')
  const origin = siteConfig.brand.baseUrl.replace(/\/+$/, '')
  const override = await getBusinessOverride(id)

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <p className="text-sm font-medium">Put the assistant on your website</p>
        <p className="mt-1 text-xs text-muted-foreground">Paste this line into your site, before the closing body tag or in your site builder&apos;s custom-code / header box. Works on WordPress, Wix, Squarespace, Shopify and plain HTML.</p>
        <div className="mt-3"><CopyField value={installSnippet(origin, id)} multiline /></div>
        <p className="mt-4 text-xs text-muted-foreground">No access to your site? Share this chat link anywhere (social bio, email signature, QR code):</p>
        <div className="mt-2"><CopyField value={`${origin}/embed/chat/${id}`} /></div>
      </div>

      <div className="card p-5">
        <p className="text-sm font-medium">Make the chat match your brand</p>
        <p className="mb-4 mt-1 text-xs text-muted-foreground">Pick your colour and change the welcome text. Changes appear on your website within a minute. Leave a field empty to use the default.</p>
        <AppearanceForm
          endpoint="/api/client/appearance"
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
    </div>
  )
}
