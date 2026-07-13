import { Phone, Bot, UserCheck, CalendarCheck, BellRing } from 'lucide-react'
import { Reveal } from '@/components/reveal'

const steps = [
  { icon: Phone, title: 'Customer calls', description: 'A customer dials your business number, any time of day.' },
  { icon: Bot, title: 'AI answers', description: 'Your AI receptionist picks up instantly with a natural voice.' },
  { icon: UserCheck, title: 'Qualifies the customer', description: 'It asks the right questions to understand what they need.' },
  { icon: CalendarCheck, title: 'Books the appointment', description: 'It finds an open slot and confirms it on the spot.' },
  { icon: BellRing, title: 'You get notified', description: 'A call summary and booking details hit your phone and inbox.' },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-16 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <p className="text-sm font-medium text-primary">How it works</p>
          <h2 className="mt-3 max-w-xl text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            From ringing phone to booked appointment in under two minutes.
          </h2>
        </Reveal>
        <ol className="relative mt-14 flex max-w-2xl flex-col gap-10">
          <div
            aria-hidden="true"
            className="absolute left-[19px] top-2 bottom-2 w-px bg-border"
          />
          {steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.08}>
              <li className="relative flex items-start gap-5">
                <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary">
                  <step.icon className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Step {i + 1}</p>
                  <h3 className="mt-1 text-base font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}
