import type { Metadata } from 'next'
import { IBM_Plex_Mono, IBM_Plex_Sans_Arabic } from 'next/font/google'
import localFont from 'next/font/local'
import { Feedback } from '../components/Feedback'
import '@dualkit/starter/tokens.css'
import '@dualkit/starter/components/styles.css'
import './globals.css'
import './v3.css'

// Switzer comes from Fontshare (ITF Free Font License, see app/fonts/LICENSE.md), so it ships with the site.
const switzer = localFont({
  src: [{ path: './fonts/Switzer-Regular.woff2', weight: '400' }, { path: './fonts/Switzer-Medium.woff2', weight: '500' }],
  variable: '--font-switzer', display: 'swap',
})
const plexArabic = IBM_Plex_Sans_Arabic({ subsets: ['arabic'], weight: ['400', '500', '600'], variable: '--font-plex-arabic', display: 'swap' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400'], variable: '--font-plex-mono', display: 'swap' })

// Berkeley Mono shows only where it is installed locally until its web licence is supplied; Plex Mono is the fallback.
const MONO_STACK = "'Berkeley Mono', var(--font-plex-mono), monospace"

export const metadata: Metadata = {
  metadataBase: new URL('https://dualkit.dev'),
  title: { default: 'Dualkit · Build for the Gulf. In both directions.', template: '%s · Dualkit' },
  description: 'Skills and formats that teach your agent to ship Arabic right the first time. Free and open source.',
  openGraph: { title: 'Dualkit', description: 'Build for the Gulf. In both directions.', url: 'https://dualkit.dev', siteName: 'Dualkit', type: 'website' },
  alternates: { types: { 'application/rss+xml': '/updates/rss.xml' } },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" data-theme="light" style={{ '--font-mono': MONO_STACK } as React.CSSProperties} className={`${switzer.variable} ${plexArabic.variable} ${plexMono.variable}`}>
      <body>{children}<Feedback /></body>
    </html>
  )
}
