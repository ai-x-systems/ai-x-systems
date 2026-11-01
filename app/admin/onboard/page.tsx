import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAdminSession } from '@/lib/accounts/session'
import { PageHeader } from '@/components/page-header'
import { OnboardHub } from './onboard-hub'
import { DashHeader } from '@/components/dash-header'

export const metadata = { title: 'Onboard client' }

export default async function OnboardPage() {
  if (!(await getAdminSession())) redirect('/admin-login')
  return (
    <div>
      <DashHeader title="Onboard a client" description="Send a setup link after they say yes, or build a private preview for a prospect." />
      <div className="mt-8"><OnboardHub /></div>
    </div>
  )
}
