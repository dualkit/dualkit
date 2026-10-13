import type { Release } from './updates'

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** RSS 2.0 for /updates. */
export function rss(releases: readonly Release[], site: string): string {
  const items = releases.map((r) => `    <item>
      <title>${xml(`${r.version}: ${r.title}`)}</title>
      <link>${site}/updates#${r.slug}</link>
      <guid isPermaLink="false">${xml(r.slug)}</guid>
      <pubDate>${new Date(`${r.date}T12:00:00Z`).toUTCString()}</pubDate>
      <description>${xml(r.body.join(' '))}</description>
    </item>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Dualkit updates</title>
    <link>${site}/updates</link>
    <description>Every Dualkit release, newest first.</description>
${items}
  </channel>
</rss>
`
}
