import { CalendarCheck, ClipboardList, Cpu, Rocket } from 'lucide-react'
import { Reveal } from '@/components/reveal'

const steps = [
  {
    icon: CalendarCheck,
    title: 'Book a demo',
    description: 'Tell us a little about your business — takes two minutes.',
  },
  {
    icon: ClipboardList,
    title: 'We learn your business',
    description: 'Services, hours, pricing structure, and how you like calls handled.',
  },
  {
    icon: Cpu,
    title: 'We build your AI',
    description: 'Trained, tested, and connected to your calendar and phone number.',
  },
  {
    icon: Rocket,
    title: 'You go live',
    description: 'Your AI Receptionist starts answering — most businesses launch in days.',
  },
]

export function Onboarding() {
  return (
    <section className="border-t border-border py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal className="mx-auto max-w-xl text-center">
          <p className="text-sm font-medium text-primary">Getting started</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            From first call with us to live in days.
          </h2>
        </Reveal>

        <div className="relative mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-5 hidden h-px bg-border lg:block"
          />
          {steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.08}>
              <div className="relative flex flex-col items-center text-center lg:items-start lg:text-left">
                <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary">
                  <step.icon className="size-4" aria-hidden="true" />
                </span>
                <p className="mt-4 text-xs font-medium text-muted-foreground">Step {i + 1}</p>
                <h3 className="mt-1 text-base font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
