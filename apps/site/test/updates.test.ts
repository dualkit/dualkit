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

  it('only calls an item released when every step is done', async () => {
    const { UP_NEXT, progress } = await import('../lib/updates')
    for (const item of UP_NEXT.filter((i) => i.state === 'Released')) expect(progress(item).percent, item.title).toBe(100)
    for (const item of UP_NEXT.filter((i) => i.state !== 'Released')) expect(progress(item).percent, item.title).toBeLessThan(100)
  })
})

describe('lint release copy', () => {
  const text = RELEASES.flatMap((r) => [r.title, ...r.body]).join('\n')
  it('names the CLDR calendar ranking, not a claim about what the Gulf uses', () => {
    expect(text).not.toContain('where the Gulf uses')
    expect(text).toContain('the Hijri calendar CLDR ranks first for Saudi Arabia, the UAE, Bahrain, Kuwait and Qatar')
  })
  it('does not call the deliberate dogfood findings only demos and fixtures', () => {
    expect(text).not.toContain('The rest were demos and test fixtures')
    expect(text).toContain('shipped site CSS')
  })
  it('has no em dashes', () => {
    expect(text).not.toContain('—')
  })
})

describe('gulf layer release', () => {
  const r = RELEASES.find((x) => x.slug === 'gulf-layer')!
  const text = [r.title, ...r.body, ...r.shipped.flatMap((s) => [s.name, s.line])].join('\n')

  it('is the newest release, dated the day it shipped', () => {
    expect(RELEASES[0]?.slug).toBe('gulf-layer')
    expect(r.date).toBe('2026-11-06')
  })

  it('ships the MCP server, the Gulf components and the Figma plugin', () => {
    expect(r.shipped.map((s) => s.name)).toEqual(['@dualkit/mcp 0.1.0-beta.0', 'shadcn registry', 'dualkit.dev/components/gulf', 'Dualkit for Figma v0'])
    expect(text).toContain('claude mcp add dualkit -- npx -y @dualkit/mcp')
    expect(text).toContain('npx shadcn@latest add https://dualkit.dev/r/gulf-phone-input.json')
  })

  it('says the Figma plugin is not on Figma Community and has not been tried in Figma', () => {
    expect(text).toContain('not on Figma Community yet')
    expect(text).toContain('We have not yet tried it in Figma')
    expect(text).not.toMatch(/install(ed)? (it )?from Figma|available on Figma Community|now on Figma Community/i)
  })

  it('states the Hijri audit result, and claims no native Arabic review', () => {
    expect(text).toContain('All 372 months match')
    expect(text).not.toMatch(/native/i)
  })
})

describe('gulf layer roadmap', () => {
  it('releases MCP and the Gulf components, and keeps Figma in progress until it is on Figma Community', async () => {
    const { UP_NEXT, progress } = await import('../lib/updates')
    const item = (title: string) => UP_NEXT.find((i) => i.title === title)!
    expect(item('Dualkit MCP').state).toBe('Released')
    expect(item('Gulf components').state).toBe('Released')
    const figma = item('Dualkit for Figma')
    expect(figma.state).toBe('In progress')
    expect(figma.steps).toContainEqual(['On Figma Community', false])
    expect(figma.steps).toContainEqual(['Check frame', true])
    expect(progress(figma).percent).toBeLessThan(100)
  })

  it('lists the next set as coming, with nothing ticked', async () => {
    const { UP_NEXT, progress } = await import('../lib/updates')
    for (const title of ['More Gulf formats', 'Listed where agents look', 'Charts in Arabic', 'Government standards', 'Mobile']) {
      const item = UP_NEXT.find((i) => i.title === title)
      expect(item?.state, title).toBe('Coming')
      expect(progress(item!).done, title).toBe(0)
    }
  })
})
