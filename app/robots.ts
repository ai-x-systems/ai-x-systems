import type { MetadataRoute } from 'next'
import { siteConfig } from '@/lib/site-config'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/thank-you', '/admin', '/admin-login', '/admin-signup', '/admin-forgot-password', '/dashboard', '/client', '/unsubscribe', '/try/', '/start/', '/reset-password', '/api/'],
    },
    sitemap: `${siteConfig.brand.baseUrl}/sitemap.xml`,
  }
}
