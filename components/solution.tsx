import {
  PhoneCall,
  CalendarCheck,
  UserCheck,
  HelpCircle,
  PhoneForwarded,
  MessageSquareText,
  Mail,
  Clock,
} from 'lucide-react'
import { Reveal } from '@/components/reveal'

const features = [
  { icon: PhoneCall, title: 'Answers every phone call', description: 'Picks up on the first ring, every time — even during rush hours.' },
  { icon: CalendarCheck, title: 'Books appointments', description: 'Checks availability and books directly into your calendar.' },
  { icon: UserCheck, title: 'Qualifies leads', description: 'Asks the right questions so you only talk to serious customers.' },
  { icon: HelpCircle, title: 'Answers FAQs', description: 'Handles pricing, hours, and service questions instantly.' },
  { icon: PhoneForwarded, title: 'Transfers urgent calls', description: 'Routes emergencies straight to you or your on-call team.' },
  { icon: MessageSquareText, title: 'Sends SMS', description: 'Confirms bookings and follows up with customers by text.' },
  { icon: Mail, title: 'Email notifications', description: 'Every call summary and new lead lands in your inbox.' },
  { icon: Clock, title: 'Works 24/7', description: 'Nights, weekends, and holidays — it never takes a day off.' },
]

export function Solution() {
  return (
    <section id="solutions" className="scroll-mt-16 border-t border-border bg-card/30 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <p className="text-sm font-medium text-primary">The solution</p>
          <h2 className="mt-3 max-w-xl text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Meet Your AI Receptionist
          </h2>
          <p className="mt-4 max-w-lg leading-relaxed text-muted-foreground">
            A trained AI agent that sounds natural, knows your business, and handles every customer
            conversation from first ring to booked appointment.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, i) => (
            <Reveal key={feature.title} delay={i * 0.05}>
              <div className="h-full rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <feature.icon className="size-4" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-sm font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
