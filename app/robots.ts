import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://truelegal.com'

  return {
    rules: {
      userAgent: '*',
      allow: ['/en/login', '/ar/login', '/en/set-password', '/ar/set-password', '/icon.png'],
      disallow: [
        '/en/dashboard', 
        '/ar/dashboard', 
        '/en/admin', 
        '/ar/admin', 
        '/en/clients', 
        '/ar/clients'
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
