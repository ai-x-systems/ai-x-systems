'use client'

import { useState, useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { Reveal } from '@/components/reveal'
import { getFaqSchema } from '@/lib/site-config'

const faqs = [
  {
    question: 'How does it work?',
    answer:
      'We train an AI agent on your business — your services, pricing structure, hours, and booking process. It then answers your phone calls and website chats exactly like a well-trained receptionist would, 24/7.',
  },
  {
    question: 'Can it book appointments?',
    answer:
      'Yes. The AI connects to your calendar or booking system, checks real availability, and confirms appointments on the spot — then sends the customer an SMS confirmation.',
  },
  {
    question: 'Can it transfer calls to a real person?',
    answer:
      'Absolutely. You define the rules — urgent issues, VIP customers, or specific request types can be transferred instantly to you or your team.',
  },
  {
    question: 'Can it answer after business hours?',
    answer:
      'Yes — that is one of its biggest strengths. Nights, weekends, and holidays are covered, so you capture the leads your competitors miss.',
  },
  {
    question: 'How long does setup take?',
    answer:
      'Most businesses are live within a few days. We handle the training, the phone number setup, and calendar integration for you.',
  },
  {
    question: 'Will it sound robotic?',
    answer:
      'No. Modern AI voices are natural and conversational. Most callers do not realize they are speaking with an AI — and every call is handled patiently and professionally.',
  },
  {
    question: 'What happens if the AI cannot answer a question?',
    answer:
      'It gracefully takes a message or transfers the call based on your rules, and you get an instant notification with the full context.',
  },
  {
    question: 'Does it work with my existing phone number?',
    answer:
      'Yes. We can forward your existing number or set up a new dedicated line — whichever fits your workflow.',
  },
  {
    question: 'What types of businesses is this for?',
    answer:
      'Any local service business that lives on phone calls: plumbers, HVAC, dental and medical offices, salons, law firms, real estate, auto shops, and more.',
  },
  {
    question: 'How much does it cost?',
    answer:
      'Pricing depends on your call volume and setup complexity, so we tailor it to your business. Book a free demo and we will walk you through setup and monthly pricing on the call.',
  },
]

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const buttonId = `faq-button-${id}`
  const panelId = `faq-panel-${id}`

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        id={buttonId}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium"
      >
        {question}
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <p id={panelId} role="region" aria-labelledby={buttonId} className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">
          {answer}
        </p>
      )}
    </div>
  )
}

export function Faq() {
  const faqSchema = getFaqSchema(faqs)

  return (
    <section id="faq" className="scroll-mt-16 border-t border-border bg-card/30 py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-4 md:px-6">
        <Reveal className="text-center">
          <p className="text-sm font-medium text-primary">FAQ</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Frequently asked questions
          </h2>
        </Reveal>
        <div className="mt-12 flex flex-col gap-3">
          {faqs.map((faq, i) => (
            <Reveal key={faq.question} delay={Math.min(i * 0.04, 0.3)}>
              <FaqItem question={faq.question} answer={faq.answer} />
            </Reveal>
          ))}
        </div>
      </div>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </section>
  )
}
