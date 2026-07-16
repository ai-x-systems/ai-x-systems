import type { MetadataRoute } from 'next'
import { siteConfig } from '@/lib/site-config'

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/demo', '/about', '/contact', '/privacy', '/terms']

  return routes.map((route) => ({
    url: `${siteConfig.brand.baseUrl}${route}`,
    lastModified: new Date(),
  }))
}
