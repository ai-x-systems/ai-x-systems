import { Play, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/reveal'

export function DemoSection() {
  return (
    <section id="demo" className="scroll-mt-16 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-primary">See it in action</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Get a Free AI Receptionist Demo for Your Business
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            We&apos;ll build a personalized demo trained on your business — your services, your
            hours, your booking flow — and walk you through exactly how it handles your customers.
            No pricing decisions before you&apos;ve seen the value.
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="relative mx-auto mt-12 aspect-video max-w-4xl overflow-hidden rounded-2xl border border-border bg-card">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.62_0.19_255/0.1),transparent_70%)]"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <button
                type="button"
                className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
                aria-label="Play demo video"
              >
                <Play className="ml-0.5 size-6" aria-hidden="true" />
              </button>
              <p className="text-sm text-muted-foreground">Watch a real AI receptionist handle a live call</p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.25} className="mt-10 flex flex-col items-center gap-3">
          <Button
            size="lg"
            className="group"
            render={<a href="mailto:hello@aixsystems.com?subject=Free%20AI%20Receptionist%20Demo" />}
          >
            Get My Free Demo
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
          <p className="text-xs text-muted-foreground">
            Setup and pricing are tailored to your business — we&apos;ll cover both on the call.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
