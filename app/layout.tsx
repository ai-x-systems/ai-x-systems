import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { siteConfig, getOrganizationSchema } from '@/lib/site-config'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.brand.baseUrl),
  title: {
    default: siteConfig.seo.defaultTitle,
    template: siteConfig.seo.titleTemplate,
  },
  description: siteConfig.seo.defaultDescription,
  keywords: siteConfig.seo.keywords,
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: siteConfig.brand.tagline,
    description: siteConfig.seo.defaultDescription,
    url: siteConfig.brand.baseUrl,
    siteName: siteConfig.brand.name,
    type: 'website',
    images: [{ url: siteConfig.seo.ogImage, width: 1200, height: 630, alt: siteConfig.brand.name }],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.brand.tagline,
    description: siteConfig.seo.defaultDescription,
    images: [siteConfig.seo.twitterImage],
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: siteConfig.seo.themeColor,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const organizationSchema = getOrganizationSchema()

  return (
    <html lang="en" className={`bg-background ${inter.variable}`}>
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </body>
    </html>
  )
}
