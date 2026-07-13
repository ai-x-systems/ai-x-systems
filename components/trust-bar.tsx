import { Clock, Zap, UserCheck, CalendarPlus } from 'lucide-react'
import { Reveal } from '@/components/reveal'

const items = [
  { icon: Clock, label: '24/7 Availability' },
  { icon: Zap, label: 'Instant Responses' },
  { icon: UserCheck, label: 'Never Miss a Lead' },
  { icon: CalendarPlus, label: 'Book More Appointments' },
]

export function TrustBar() {
  return (
    <section className="border-y border-border bg-card/40">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <ul className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {items.map((item, i) => (
            <Reveal key={item.label} delay={i * 0.08}>
              <li className="flex items-center justify-center gap-2.5 text-sm font-medium text-muted-foreground">
                <item.icon className="size-4 text-primary" aria-hidden="true" />
                {item.label}
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
