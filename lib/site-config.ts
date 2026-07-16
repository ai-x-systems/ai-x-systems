// =============================================================================
// SINGLE SOURCE OF TRUTH for brand, contact, SEO, and structured data.
//
// Every page, layout, metadata object, schema block, and footer/contact
// section should import from here instead of hardcoding strings. When the
// domain is purchased, update PRODUCTION_DOMAIN below and everything that
// depends on it (canonical URLs, OG images, emails, schema) updates with it.
// =============================================================================

// ---------------------------------------------------------------------------
// 1. Domain & base URL
// ---------------------------------------------------------------------------

/**
 * Intended production domain. NOT purchased yet — treat as a future value.
 * Do not link to this domain as if it's live; it only becomes `baseUrl`
 * below once NEXT_PUBLIC_SITE_URL is set (see getBaseUrl).
 */
const PRODUCTION_DOMAIN = 'aixsystems.app'

/**
 * Resolves the base URL for canonical links, OG images, and schema.
 * Priority: explicit env var > Vercel's own deployment URL > production
 * domain placeholder. This means dev/preview deploys never accidentally
 * claim the not-yet-owned production domain.
 */
function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return `https://${PRODUCTION_DOMAIN}`
}

// ---------------------------------------------------------------------------
// 2. Brand
// ---------------------------------------------------------------------------

const brand = {
  name: 'AI x Systems',
  shortName: 'AI x Systems',
  legalName: 'AI x Systems',
  tagline: 'Never Miss Another Customer Call.',
  description:
    'AI x Systems installs AI Receptionists for local businesses — answering every call and website chat 24/7, qualifying leads, and booking appointments automatically.',
  domain: PRODUCTION_DOMAIN,
  baseUrl: getBaseUrl(),
}

// ---------------------------------------------------------------------------
// 3. Contact
//
// IMPORTANT: these are PUBLIC-facing placeholders on the not-yet-purchased
// aixsystems.app domain. The real internal admin inbox is intentionally
// NOT defined here and must never be added to this file or referenced in
// any UI, metadata, legal page, or structured data — this config is
// imported by public components, so anything placed here is public.
// ---------------------------------------------------------------------------

const contact = {
  email: 'hello@aixsystems.app',
  supportEmail: 'support@aixsystems.app',
  demoEmail: 'demo@aixsystems.app',
  phone: null as string | null, // TODO: add once a business line is provisioned
  address: null as string | null, // TODO: add if/when a public business address is needed
}

// ---------------------------------------------------------------------------
// 4. Social links
// ---------------------------------------------------------------------------

const social = {
  instagram: {
    handle: '@aixsautomation',
    url: 'https://instagram.com/aixsautomation',
  },
  // Add x/linkedin/etc. here as accounts are created — nothing else in the
  // app should hardcode a social URL.
}

// ---------------------------------------------------------------------------
// 5. Navigation
// ---------------------------------------------------------------------------

const nav = {
  main: [
    { href: '#solutions', label: 'Solutions' },
    { href: '#how-it-works', label: 'How It Works' },
    { href: '#demo', label: 'Demo' },
    { href: '#faq', label: 'FAQ' },
  ],
  footer: [
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
    { href: '/privacy', label: 'Privacy' },
    { href: '/terms', label: 'Terms' },
  ],
}

// ---------------------------------------------------------------------------
// 6. Forms
// ---------------------------------------------------------------------------

const forms = {
  // Tally form ID only (the part after /r/, e.g. "44yy7k" for
  // https://tally.so/r/44yy7k) — NOT the full URL, or the embed breaks.
  // Reminder: in Tally's settings, set "redirect on completion" to
  // `${baseUrl}/thank-you` so the funnel connects end to end.
  tallyFormId: '44yy7k',
  demoPath: '/demo',
  thankYouPath: '/thank-you',
}

function getTallyEmbedUrl(formId: string = forms.tallyFormId): string {
  return `https://tally.so/embed/${formId}?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1`
}

// ---------------------------------------------------------------------------
// 7. Future integrations (not wired up yet — placeholders only)
// ---------------------------------------------------------------------------

const integrations = {
  analytics: {
    // e.g. Google Analytics / Plausible / PostHog ID once chosen.
    id: null as string | null,
  },
  brevo: {
    // Transactional/marketing email — add API key via env var, never here.
    listId: null as string | null,
  },
}

// ---------------------------------------------------------------------------
// 8. SEO defaults
// ---------------------------------------------------------------------------

const seo = {
  titleTemplate: '%s — AI x Systems',
  defaultTitle: 'AI x Systems — AI Receptionists for Local Businesses',
  defaultDescription: brand.description,
  keywords: [
    'AI receptionist',
    'AI phone answering service',
    'AI chatbot for small business',
    'appointment booking automation',
    'missed call recovery',
  ],
  ogImage: '/og-image.png',
  twitterImage: '/twitter-image.png',
  themeColor: '#0f0f10',
}

// ---------------------------------------------------------------------------
// 9. Structured data (Schema.org)
// ---------------------------------------------------------------------------

/** Organization schema — always safe to render, no address/phone required. */
function getOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: brand.name,
    url: brand.baseUrl,
    logo: `${brand.baseUrl}/brand/logo-dark.svg`,
    description: brand.description,
    sameAs: [social.instagram.url],
  }
}

/**
 * LocalBusiness schema — prepared but NOT rendered by default, since AI x
 * Systems doesn't operate as a local storefront and street address/phone
 * aren't set yet. Wire this into layout.tsx once `contact.address` and
 * `contact.phone` are real.
 */
function getLocalBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: brand.name,
    url: brand.baseUrl,
    email: contact.email,
    telephone: contact.phone ?? undefined,
    address: contact.address ?? undefined,
  }
}

/** FAQPage schema — pass the same Q&A pairs rendered in the FAQ component. */
function getFaqSchema(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const siteConfig = {
  brand,
  contact,
  social,
  nav,
  forms,
  integrations,
  seo,
}

export { getTallyEmbedUrl, getOrganizationSchema, getLocalBusinessSchema, getFaqSchema }
