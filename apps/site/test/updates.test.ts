import { describe, expect, it } from 'vitest'
import { RELEASES, displayDate } from '../lib/updates'
import { rss } from '../lib/rss'

describe('releases', () => {
  it('are newest first', () => {
    const dates = RELEASES.map((r) => r.date)
    expect(dates).toEqual([...dates].sort().reverse())
  })

  it('have unique slugs', () => {
    expect(new Set(RELEASES.map((r) => r.slug)).size).toBe(RELEASES.length)
  })

  it('show dates the British way', () => {
    expect(displayDate('2026-10-13')).toBe('13 Oct 2026')
  })
})

describe('rss', () => {
  it('lists every release with a link and a date', () => {
    const xml = rss(RELEASES, 'https://dualkit.dev')
    for (const r of RELEASES) {
      expect(xml).toContain(`<link>https://dualkit.dev/updates#${r.slug}</link>`)
      expect(xml).toContain(`<pubDate>${new Date(`${r.date}T12:00:00Z`).toUTCString()}</pubDate>`)
    }
  })

  it('escapes characters that would break the XML', () => {
    const xml = rss([{ ...RELEASES[0]!, title: 'Tom & Jerry <3' }], 'https://dualkit.dev')
    expect(xml).toContain('Tom &amp; Jerry &lt;3')
  })
})
