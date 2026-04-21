import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/app/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "SIAKAD PMII Sunan Ampel Malang",
    template: "%s | SIAKAD PMII"
  },
  description: "Sistem Informasi Akademik dan Kaderisasi (SIAKAD) PK. PMII Sunan Ampel Malang. Platform digitalisasi untuk manajemen kader, raport, kurikulum, dan administrasi persuratan.",
  keywords: [
    "PMII", 
    "SIAKAD PMII", 
    "Kaderisasi PMII", 
    "PK PMII Sunan Ampel Malang", 
    "PMII UIN Malang",
    "Aplikasi Kaderisasi", 
    "Manajemen Kader"
  ],
  authors: [{ name: "PK. PMII Sunan Ampel Malang" }],
  openGraph: {
    title: "SIAKAD PMII Sunan Ampel Malang",
    description: "Platform digital manajemen kader PMII yang adaptif dan cakap digital untuk PK. PMII Sunan Ampel Malang.",
    url: "https://siakad.pmii-uinmalang.or.id",
    siteName: "SIAKAD PMII",
    locale: "id_ID",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: "9WAeDKwCccLxdpW0BAlYJmDJOg-hwNzAqkiSs0PL9WI",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}