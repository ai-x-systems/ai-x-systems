import type { Metadata } from 'next'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { PageHeader } from '@/components/page-header'

export const metadata: Metadata = {
  title: 'Client access',
  robots: { index: false },
}

export default function Page() {
  return (
    <>
      <Navbar />
      <main className="pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="mx-auto max-w-sm px-4 md:px-6">
          <PageHeader eyebrow="Client Portal" title="Access is by invitation" description="Dashboard logins are created for you when your AI receptionist is set up." />
          <p className="mt-6 text-sm text-muted-foreground">
            <a href="/demo" className="text-primary underline underline-offset-4">Request a demo</a> and we will set up your dashboard login when your AI receptionist goes live.
            Already have a login?{' '}
            <a href="/client/login" className="text-primary underline underline-offset-4">Log in</a>.
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
