import { CheckCircle2 } from 'lucide-react'
import { Reveal } from '@/components/reveal'

const businesses = [
  'Dentists & Medical Clinics',
  'Law Firms',
  'HVAC',
  'Plumbing & Electrical',
  'Real Estate',
  'Gyms & Fitness Studios',
  'Beauty & Salons',
  'Home Services',
  'Auto Shops',
  'Consultants',
]

export function WhoItsFor() {
  return (
    <section className="border-t border-border py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-primary">Who it&apos;s for</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Built for businesses that live on the phone.
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            If missed calls cost you customers, this is for you.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-10">
          <ul className="mx-auto flex max-w-3xl flex-wrap justify-center gap-3">
            {businesses.map((business) => (
              <li
                key={business}
                className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground"
              >
                <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                {business}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
