import { MetadataRoute } from 'next'
 
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Cegah Google masuk ke rute privat di bawah ini:
      disallow: [
        '/dashboard-kader', 
        '/dashboard-pendamping', 
        '/dashboard-rayon', 
        '/dashboard-komisariat'
      ],
    },
    sitemap: 'https://siakad.pmii-uinmalang.or.id/sitemap.xml',
  }
}