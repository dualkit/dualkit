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

describe('roadmap', () => {
  it('counts progress from its steps, never a typed number', async () => {
    const { progress } = await import('../lib/updates')
    expect(progress({ title: 't', line: 'l', state: 'Coming', steps: [['a', true], ['b', false], ['c', false]] })).toEqual({ done: 1, total: 3, percent: 33 })
  })

  it('never shows a percentage that no step backs up', async () => {
    const { UP_NEXT, progress } = await import('../lib/updates')
    for (const item of UP_NEXT) expect(item.steps.length, item.title).toBeGreaterThan(0)
    expect(UP_NEXT.filter((i) => i.state === 'In progress').every((i) => progress(i).done > 0)).toBe(true)
  })
})
