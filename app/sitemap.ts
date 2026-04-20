import { MetadataRoute } from 'next'
 
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://siakad.pmii-uinmalang.or.id',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1, // Prioritas tertinggi untuk halaman depan
    }
    // Jika nanti ada halaman publik lain seperti /tentang-kami atau /berita, tambahkan di sini
  ]
}