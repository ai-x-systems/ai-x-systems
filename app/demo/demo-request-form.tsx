'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { COUNTRIES } from '@/lib/data/countries'

type ServiceType = 'voice' | 'chatbot' | 'both'

const SERVICE_OPTIONS: { value: ServiceType; label: string; blurb: string }[] = [
  {
    value: 'voice',
    label: 'AI Voice Receptionist',
    blurb: 'Answers your business phone line, books appointments, takes messages.',
  },
  {
    value: 'chatbot',
    label: 'AI Website Chatbot',
    blurb: 'Lives on your website, answers questions, captures leads, books appointments.',
  },
  {
    value: 'both',
    label: 'Both',
    blurb: 'Voice Receptionist for your phone line and a Chatbot for your website.',
  },
]

export function DemoRequestForm() {
  const [businessName, setBusinessName] = useState('')
  const [hp, setHp] = useState('')
  const [industry, setIndustry] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [serviceType, setServiceType] = useState<ServiceType | ''>('')
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [businessHours, setBusinessHours] = useState('')
  const [offerings, setOfferings] = useState('')
  const [challenges, setChallenges] = useState('')
  const [volume, setVolume] = useState('')
  const [referralSource, setReferralSource] = useState('')
  const [details, setDetails] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!serviceType) {
      setError('Please choose which service you\u2019re interested in.')
      return
    }
    if (!country) {
      setError('Please select your country.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hp,
          businessName,
          industry,
          country,
          city,
          serviceType,
          contactName,
          email,
          phone,
          website,
          businessHours,
          offerings,
          challenges,
          volume,
          referralSource,
          details,
        }),
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.error ?? 'Could not submit. Please try again.')
        return
      }

      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <p className="text-sm text-muted-foreground">
        Thanks! We&apos;ve got your details and will reach out with your personalized demo shortly.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Honeypot: hidden from people, filled by bots. */}
      <input
        type="text"
        name="company_website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />
      <div className="space-y-3">
        <label className="text-sm font-medium">Which service are you interested in?</label>
        <div className="grid gap-3 sm:grid-cols-3">
          {SERVICE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setServiceType(opt.value)}
              className={`rounded-xl border p-4 text-left transition-colors ${serviceType === opt.value ? 'border-primary bg-primary/10' : 'border-border bg-input/20 hover:border-muted-foreground'}`}
            >
              <p className="text-sm font-medium">{opt.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{opt.blurb}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-sm font-medium">Your business</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="businessName" className="text-sm font-medium">Business name</label>
            <input id="businessName" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="industry" className="text-sm font-medium">Industry</label>
            <input id="industry" placeholder="e.g. Dental, HVAC, Law firm" value={industry} onChange={(e) => setIndustry(e.target.value)} className="w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="country" className="text-sm font-medium">Country</label>
            <select id="country" required value={country} onChange={(e) => setCountry(e.target.value)} style={{ colorScheme: 'dark' }} className="w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
              <option value="" disabled style={{ backgroundColor: '#0a0a0a', color: '#fafafa' }}>Select a country</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c} style={{ backgroundColor: '#0a0a0a', color: '#fafafa' }}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="city" className="text-sm font-medium">City <span className="text-muted-foreground">(optional)</span></label>
            <input id="city" value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="website" className="text-sm font-medium">Website <span className="text-muted-foreground">(optional)</span></label>
          <input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} className="w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="businessHours" className="text-sm font-medium">Business hours <span className="text-muted-foreground">(optional)</span></label>
          <input id="businessHours" placeholder="e.g. Mon–Fri 9am–6pm" value={businessHours} onChange={(e) => setBusinessHours(e.target.value)} className="w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="offerings" className="text-sm font-medium">Services or products you offer <span className="text-muted-foreground">(optional)</span></label>
          <textarea id="offerings" rows={3} placeholder="What should the AI know you offer?" value={offerings} onChange={(e) => setOfferings(e.target.value)} className="w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-sm font-medium">You</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="contactName" className="text-sm font-medium">Your name</label>
            <input id="contactName" required value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="phone" className="text-sm font-medium">Phone <span className="text-muted-foreground">(optional, include country code)</span></label>
          <input id="phone" placeholder="e.g. +92 300 1234567" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-sm font-medium">What you need</p>
        <div className="space-y-1.5">
          <label htmlFor="challenges" className="text-sm font-medium">What should the AI handle, and what&apos;s the biggest problem it should solve? <span className="text-muted-foreground">(optional)</span></label>
          <textarea id="challenges" rows={3} placeholder="e.g. We miss calls during busy hours, or our website visitors leave without booking" value={challenges} onChange={(e) => setChallenges(e.target.value)} className="w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="volume" className="text-sm font-medium">Roughly how many calls or chats per week? <span className="text-muted-foreground">(optional)</span></label>
            <input id="volume" placeholder="e.g. 50–100" value={volume} onChange={(e) => setVolume(e.target.value)} className="w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="referralSource" className="text-sm font-medium">How did you hear about us? <span className="text-muted-foreground">(optional)</span></label>
            <input id="referralSource" value={referralSource} onChange={(e) => setReferralSource(e.target.value)} className="w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="details" className="text-sm font-medium">Anything else? <span className="text-muted-foreground">(optional)</span></label>
          <textarea id="details" rows={3} value={details} onChange={(e) => setDetails(e.target.value)} className="w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Submitting…' : 'Get my free demo'}
      </Button>
    </form>
  )
}
