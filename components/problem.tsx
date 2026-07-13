import { PhoneMissed, Timer, MoonStar, ClipboardList, Filter } from 'lucide-react'
import { Reveal } from '@/components/reveal'

const problems = [
  {
    icon: PhoneMissed,
    title: 'Missed phone calls',
    description: 'Every unanswered call is a customer calling your competitor next.',
  },
  {
    icon: Timer,
    title: 'Slow replies',
    description: 'Leads go cold in minutes. Most businesses respond hours later.',
  },
  {
    icon: MoonStar,
    title: 'No after-hours support',
    description: 'Customers need help at 9 PM. Your voicemail is not an answer.',
  },
  {
    icon: ClipboardList,
    title: 'Manual appointment booking',
    description: 'Phone tag and back-and-forth emails waste hours every week.',
  },
  {
    icon: Filter,
    title: 'Poor lead qualification',
    description: 'Time gets spent on tire-kickers while serious buyers wait.',
  },
]

export function Problem() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <p className="text-sm font-medium text-primary">The problem</p>
          <h2 className="mt-3 max-w-xl text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Local businesses lose thousands every month to missed conversations.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {problems.map((problem, i) => (
            <Reveal key={problem.title} delay={i * 0.06}>
              <div className="h-full rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30">
                <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  <problem.icon className="size-4" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-sm font-semibold">{problem.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {problem.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
