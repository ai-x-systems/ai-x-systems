import type { Metadata } from 'next'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { PageHeader } from '@/components/page-header'
import { ClientLoginForm } from './client-login-form'

export const metadata: Metadata = {
  title: 'Client Log in',
  description: 'Log in to your AI x Systems client dashboard.',
}

export default function ClientLoginPage() {
  return (
    <>
      <Navbar />
      <main className="pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="mx-auto max-w-sm px-4 md:px-6">
          <PageHeader eyebrow="Client Portal" title="Log in" description="Access your dashboard." />
          <div className="mt-8">
            <ClientLoginForm />
          </div>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            <a href="/client/forgot-password" className="text-primary underline underline-offset-4">
              Forgot password?
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
