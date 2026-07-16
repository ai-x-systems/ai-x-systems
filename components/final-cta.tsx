import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/reveal'

export function FinalCta() {
  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[360px] bg-[radial-gradient(ellipse_at_bottom,oklch(0.62_0.19_255/0.14),transparent_65%)]"
      />
      <Reveal className="relative mx-auto max-w-2xl px-4 text-center md:px-6">
        <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-5xl">
          Ready to Stop Missing Customers?
        </h2>
        <p className="mt-4 text-pretty leading-relaxed text-muted-foreground md:text-lg">
          Get a free AI receptionist demo built for your business — and see exactly how many more
          appointments you could be booking.
        </p>
        <div className="mt-8 flex justify-center">
          <Button size="lg" className="group" render={<a href="/demo" />}>
            Get a Free AI Receptionist Demo
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </div>
      </Reveal>
    </section>
  )
}
