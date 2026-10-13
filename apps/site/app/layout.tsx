import type { Metadata } from 'next'
import { IBM_Plex_Mono, IBM_Plex_Sans_Arabic } from 'next/font/google'
import localFont from 'next/font/local'
import { Feedback } from '../components/Feedback'
import './globals.css'

// Switzer comes from Fontshare (ITF Free Font License, see app/fonts/LICENSE.md), so it ships with the site.
const switzer = localFont({
  src: [{ path: './fonts/Switzer-Regular.woff2', weight: '400' }, { path: './fonts/Switzer-Medium.woff2', weight: '500' }],
  variable: '--font-switzer', display: 'swap',
})
const plexArabic = IBM_Plex_Sans_Arabic({ subsets: ['arabic'], weight: ['400', '500', '600'], variable: '--font-plex-arabic', display: 'swap' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400'], variable: '--font-plex-mono', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL('https://dualkit.dev'),
  title: { default: 'Dualkit · Build for the Gulf. In both directions.', template: '%s · Dualkit' },
  description: 'Skills and formats that teach your agent to ship Arabic right the first time. Free and open source.',
  openGraph: { title: 'Dualkit', description: 'Build for the Gulf. In both directions.', url: 'https://dualkit.dev', siteName: 'Dualkit', type: 'website' },
  alternates: { types: { 'application/rss+xml': '/updates/rss.xml' } },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={`${switzer.variable} ${plexArabic.variable} ${plexMono.variable}`}>
      <body>{children}<Feedback /></body>
    </html>
  )
}
