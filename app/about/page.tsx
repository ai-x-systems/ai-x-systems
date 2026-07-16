import type { Metadata } from 'next'
import { Phone, Bot, Wrench } from 'lucide-react'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { siteConfig } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'About',
  description: `${siteConfig.brand.name} installs AI Receptionists for local businesses — the mission, and how we work.`,
}

const principles = [
  {
    icon: Phone,
    title: 'Outcomes, not software',
    description:
      "Businesses don't buy AI — they buy never missing a call, booking more appointments, and capturing every lead. That's what we install.",
  },
  {
    icon: Wrench,
    title: 'Fully implemented, not DIY',
    description:
      'We configure, train, and deploy your AI Receptionist for you — your team never touches a prompt or a dashboard of settings.',
  },
  {
    icon: Bot,
    title: 'One focused offer',
    description:
      "For now, we do one thing well: the AI Receptionist. We'd rather deliver one product exceptionally than spread across ten.",
  },
]

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="mx-auto max-w-2xl px-4 md:px-6">
          <PageHeader
            eyebrow="About"
            title={`${siteConfig.brand.name} helps businesses stop losing customers.`}
            description="Every missed call is a customer who calls your competitor next. We install AI Receptionists that answer instantly, every time — day or night — so that never happens."
          />
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl gap-6 px-4 sm:grid-cols-3 md:px-6">
          {principles.map((principle) => (
            <div key={principle.title} className="rounded-2xl border border-border bg-card/40 p-6">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <principle.icon className="size-5" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-sm font-semibold">{principle.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {principle.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-16 max-w-2xl px-4 text-center md:px-6">
          <Button size="lg" render={<a href={siteConfig.forms.demoPath} />}>
            Get a Free AI Receptionist Demo
          </Button>
        </div>
      </main>
      <Footer />
    </>
  )
}
