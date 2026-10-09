import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAdminSession } from '@/lib/accounts/session'
import { AppTopbar } from '@/components/app-topbar'
import { PageHeader } from '@/components/page-header'
import { OnboardHub } from './onboard-hub'

export const metadata = { title: 'Onboard client' }

export default async function OnboardPage() {
  if (!(await getAdminSession())) redirect('/admin-login')
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-16 md:px-6">
      <AppTopbar current="admin" />
      <div className="flex items-start justify-between gap-4">
        <PageHeader eyebrow="Admin" title="Onboard a client" description="Send a setup link after they say yes, or build a private preview for a prospect." />
        <Link href="/admin" className="text-sm text-primary underline underline-offset-4">Back to Clients</Link>
      </div>
      <div className="mt-8"><OnboardHub /></div>
    </main>
  )
}
