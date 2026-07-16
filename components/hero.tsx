'use client'

import { motion } from 'framer-motion'
import { Phone, CalendarCheck, MessageSquare, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const steps = [
  {
    icon: Phone,
    title: 'Incoming call',
    detail: '(555) 812-4409 · New customer',
    delay: 0.6,
  },
  {
    icon: MessageSquare,
    title: 'AI answers instantly',
    detail: '"Thanks for calling Summit Plumbing, how can I help?"',
    delay: 1.2,
  },
  {
    icon: CalendarCheck,
    title: 'Appointment booked',
    detail: 'Tuesday, 10:30 AM · Drain inspection',
    delay: 1.8,
  },
  {
    icon: MessageSquare,
    title: 'SMS confirmation sent',
    detail: `"You're booked for Tuesday at 10:30 AM."`,
    delay: 2.4,
  },
]

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_at_top,oklch(0.62_0.19_255/0.12),transparent_65%)]"
      />
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 md:grid-cols-2 md:px-6">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground"
          >
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            Your AI Receptionist — Phone &amp; Website
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-balance text-4xl font-semibold tracking-tight md:text-6xl"
          >
            Never Miss Another Customer Call.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-5 max-w-md text-pretty leading-relaxed text-muted-foreground md:text-lg"
          >
            One AI Receptionist that answers your phone and your website 24/7, qualifies leads,
            and books appointments automatically.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8 flex flex-col gap-3 sm:flex-row"
          >
            <Button size="lg" className="group" render={<a href="/demo" />}>
              Get a Free AI Receptionist Demo
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
            <Button size="lg" variant="outline" render={<a href="#chatbot" />}>
              See It Answer Live
            </Button>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="mt-4 text-xs text-muted-foreground"
          >
            Personalized to your business. No commitment required.
          </motion.p>
        </div>

        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute -inset-6 rounded-3xl bg-primary/5 blur-2xl"
          />
          <div className="relative rounded-2xl border border-border bg-card/60 p-5 backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
              <p className="text-sm font-medium">Live call handling</p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
                <motion.span
                  className="size-1.5 rounded-full bg-primary"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.6, repeat: Number.POSITIVE_INFINITY }}
                  aria-hidden="true"
                />
                Active
              </span>
            </div>
            <ul className="flex flex-col gap-3">
              {steps.map((step) => (
                <motion.li
                  key={step.title}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: step.delay }}
                  className="flex items-start gap-3 rounded-xl border border-border bg-background/60 p-3.5"
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <step.icon className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {step.detail}
                    </p>
                  </div>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
