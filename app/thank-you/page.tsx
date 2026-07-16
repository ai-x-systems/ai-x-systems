import type { Metadata } from 'next'
import { CheckCircle2 } from 'lucide-react'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { PageHeader } from '@/components/page-header'

export const metadata: Metadata = {
  title: "You're In",
  description: 'Thanks for reaching out. Here is what happens next.',
  robots: { index: false },
}

const nextSteps = [
  {
    title: "We'll build your personalized demo",
    description:
      'Using what you told us about your business, we train an AI Receptionist on your services, hours, and booking flow.',
  },
  {
    title: "We'll send you the demo link",
    description: 'Usually within 1–2 business days, straight to your email.',
  },
  {
    title: "We'll walk you through it live",
    description:
      'A short call to show you exactly how it handles your customers — pricing and setup covered on the same call.',
  },
]

export default function ThankYouPage() {
  return (
    <>
      <Navbar />
      <main className="pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="mx-auto max-w-2xl px-4 text-center md:px-6">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="size-7" aria-hidden="true" />
          </span>
          <div className="mt-6">
            <PageHeader
              align="center"
              title="We'll build a personalized demo for your business."
              description="Thanks for sharing your details. Here's exactly what happens next."
            />
          </div>
        </div>

        <div className="mx-auto mt-14 flex max-w-lg flex-col gap-6 px-4 md:px-6">
          {nextSteps.map((step, i) => (
            <div key={step.title} className="flex items-start gap-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-sm font-medium text-primary">
                {i + 1}
              </span>
              <div>
                <h2 className="text-sm font-semibold">{step.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </>
  )
}
