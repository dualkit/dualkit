import type { Metadata } from 'next'
import { Geist, Geist_Mono, Readex_Pro } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' })
const readex = Readex_Pro({ subsets: ['arabic', 'latin'], weight: ['400', '500', '600'], variable: '--font-readex', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL('https://dualkit.dev'),
  title: { default: 'Dualkit · Build for the Gulf. In both directions.', template: '%s · Dualkit' },
  description: 'Skills, formats and a starter for products that ship in Arabic and English. Free and open source.',
  openGraph: { title: 'Dualkit', description: 'Build for the Gulf. In both directions.', url: 'https://dualkit.dev', siteName: 'Dualkit', type: 'website' },
  alternates: { types: { 'application/rss+xml': '/updates/rss.xml' } },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={`${geist.variable} ${geistMono.variable} ${readex.variable}`}>
      <body>{children}</body>
    </html>
  )
}
