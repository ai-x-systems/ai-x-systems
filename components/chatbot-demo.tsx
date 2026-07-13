'use client'

import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import { Reveal } from '@/components/reveal'

const messages = [
  {
    from: 'customer' as const,
    text: 'Do you offer emergency plumbing?',
    delay: 0.2,
  },
  {
    from: 'ai' as const,
    text: "Yes — we're available 24/7 for emergencies. Can I get your name and address so I can dispatch a technician?",
    delay: 0.7,
  },
  {
    from: 'customer' as const,
    text: 'Sarah Mitchell, 42 Oakwood Drive. Kitchen sink is flooding.',
    delay: 1.2,
  },
  {
    from: 'ai' as const,
    text: "Got it, Sarah. I've booked our next available technician — they'll arrive within 45 minutes. You'll get a text confirmation shortly.",
    delay: 1.7,
  },
]

export function ChatbotDemo() {
  return (
    <section id="chatbot" className="scroll-mt-16 border-t border-border bg-card/30 py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 md:grid-cols-2 md:px-6">
        <Reveal>
          <p className="text-sm font-medium text-primary">Website chatbot</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Your website answers back — and books the job.
          </h2>
          <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
            Visitors get instant answers instead of a contact form that goes nowhere. The chatbot
            captures the lead, qualifies the request, and books the appointment while their intent
            is highest.
          </p>
          <ul className="mt-6 flex flex-col gap-3">
            {['Responds in under a second', 'Captures every lead automatically', 'Books directly into your calendar'].map(
              (item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                  {item}
                </li>
              ),
            )}
          </ul>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur-md">
            <div className="mb-4 flex items-center gap-2 border-b border-border pb-4">
              <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
              <p className="text-sm font-medium">Summit Plumbing — Live Chat</p>
            </div>
            <div className="flex flex-col gap-3" role="log" aria-label="Example chat conversation">
              {messages.map((message) => (
                <motion.div
                  key={message.text}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: message.delay }}
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    message.from === 'ai'
                      ? 'self-start bg-secondary text-secondary-foreground'
                      : 'self-end bg-primary text-primary-foreground'
                  }`}
                >
                  {message.text}
                </motion.div>
              ))}
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 2.2 }}
                className="mt-1 flex items-center gap-2 self-start rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary"
              >
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                Lead captured · Appointment booked
              </motion.div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
