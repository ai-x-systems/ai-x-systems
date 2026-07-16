import { Navbar } from '@/components/navbar'
import { Hero } from '@/components/hero'
import { TrustBar } from '@/components/trust-bar'
import { Problem } from '@/components/problem'
import { Solution } from '@/components/solution'
import { WhoItsFor } from '@/components/who-its-for'
import { HowItWorks } from '@/components/how-it-works'
import { ChatbotDemo } from '@/components/chatbot-demo'
import { DemoSection } from '@/components/demo-section'
import { Faq } from '@/components/faq'
import { Onboarding } from '@/components/onboarding'
import { FinalCta } from '@/components/final-cta'
import { Footer } from '@/components/footer'

export default function Page() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <TrustBar />
        <Problem />
        <Solution />
        <WhoItsFor />
        <HowItWorks />
        <ChatbotDemo />
        <DemoSection />
        <Faq />
        <Onboarding />
        <FinalCta />
      </main>
      <Footer />
    </>
  )
}
