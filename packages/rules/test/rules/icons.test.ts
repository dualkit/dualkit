import { afterAll, describe, expect, it } from 'vitest'
import { iconRules } from '../../src/rules/icons'
import { runRules } from '../../src/run'
import { page } from '../fixtures'
import { closeBrowser, modelOf } from '../helpers/browser'
import { icon, screen } from '../helpers/model'

afterAll(closeBrowser)

const ids = (m: Parameters<typeof runRules>[0]) => runRules(m, { rules: iconRules }).map((f) => f.rule)

describe('icons/not-mirrored', () => {
  it.each(['arrow-right', 'chevron-left', 'lucide-chevron-right', 'back', 'send', 'caret_left'])('flags %s in RTL when not mirrored', (name) => {
    expect(ids(screen({ icons: [icon({ name })] }))).toEqual(['icons/not-mirrored'])
  })
  it.each(['fast-forward', 'fast-back', 'skip-next', 'skip-back', 'skip-forward', 'media-next', 'player-play-next', 'seek-forward', 'seek-back'])('leaves the media control %s alone', (name) => {
    expect(ids(screen({ icons: [icon({ name })] }))).toEqual([])
  })
  it('passes mirrored icons, LTR icons, unnamed and non-directional icons', () => {
    expect(ids(screen({ icons: [icon({ mirrored: true }), icon({ dir: 'ltr' }), icon({ name: null }), icon({ name: 'search' })] }))).toEqual([])
  })
})

describe('icons/mirrored-by-mistake', () => {
  it.each(['play', 'check', 'clock', 'brand-logo'])('flags a mirrored %s', (name) => {
    expect(ids(screen({ icons: [icon({ name, mirrored: true })] }))).toEqual(['icons/mirrored-by-mistake'])
  })
  it('does not confuse playlist or checkout with play and check', () => {
    expect(ids(screen({ icons: [icon({ name: 'playlist', mirrored: true }), icon({ name: 'checkout', mirrored: true })] }))).toEqual([])
  })
  it.each(['help', 'question', 'help-circle', 'circle-question'])('accepts a mirrored %s, because the Arabic question mark is mirrored', (name) => {
    expect(ids(screen({ icons: [icon({ name, mirrored: true })] }))).toEqual([])
  })
})

describe('icons/not-mirrored on icons named by their surroundings', () => {
  it('flags an unnamed inline SVG chevron inside <button aria-label="Next"> in RTL', async () => {
    const html = page('<button aria-label="Next"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M5 2l6 6-6 6"/></svg></button>')
    const found = runRules(await modelOf(html), { rules: iconRules }).map((f) => f.rule)
    expect(found).toEqual(['icons/not-mirrored'])
    expect(runRules(await modelOf(html.replace('<svg', '<svg style="transform:scaleX(-1)"')), { rules: iconRules })).toEqual([])
  })
  const chevron = '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M5 2l6 6-6 6"/></svg>'
  const quiet = async (body: string) => runRules(await modelOf(page(body)), { rules: iconRules }).map((f) => f.rule)
  const magnifier = '<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="7" cy="7" r="5"/><line x1="11" y1="11" x2="15" y2="15"/></svg>'
  it('reads an unnamed magnifier that is the only content of a "Next page" button as directional, by design', async () => {
    expect(await quiet(`<button aria-label="Next page">${magnifier}</button>`)).toEqual(['icons/not-mirrored'])
  })
  it('does not borrow the control name for an icon that has its own name', async () => {
    const search = '<svg data-icon="search" width="16" height="16"><circle cx="7" cy="7" r="5"/></svg>'
    expect(await quiet(`<button aria-label="Next page">${search}</button>`)).toEqual([])
  })
  it('does not borrow the control name when an unnamed icon sits beside visible text', async () => {
    expect(await quiet(`<button aria-label="Next">${chevron} التالي</button>`)).toEqual([])
  })
  it('still names an aria-hidden chevron that is the only content of the button', async () => {
    expect(await quiet(`<button aria-label="Next">${chevron.replace('<svg', '<svg aria-hidden="true"')}</button>`)).toEqual(['icons/not-mirrored'])
  })
  it.each([
    ['screen-reader-only text', '<span class="sr-only">Next</span>'],
    ['display:none text', '<span style="display:none">Next</span>'],
    ['visibility:hidden text', '<span style="visibility:hidden">Next</span>'],
    ['a display:none second icon', '<svg style="display:none" width="16" height="16"><path d="M0 0h4"/></svg>'],
    ['a screen-reader-only second icon', '<svg class="sr-only" width="16" height="16"><path d="M0 0h4"/></svg>'],
  ])('still names the icon with %s beside it', async (_n, extra) => {
    const css = '<style>.sr-only{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}</style>'
    expect(await quiet(`${css}<button aria-label="Next">${chevron}${extra}</button>`)).toEqual(['icons/not-mirrored'])
  })
  it('does not borrow the link name for a logo beside text or another icon', async () => {
    const logo = '<svg width="16" height="16"><rect width="16" height="16"/></svg>'
    expect(await quiet(`<a href="#" aria-label="Back to home">${logo}<span>الرئيسية</span></a>`)).toEqual([])
    expect(await quiet(`<a href="#" aria-label="Back to home">${logo}${logo}</a>`)).toEqual([])
  })
  it('cannot name a fully unnamed SVG, so it stays quiet', async () => {
    const html = page('<button><svg width="16" height="16"><path d="M5 2l6 6-6 6"/></svg></button>')
    expect(runRules(await modelOf(html), { rules: iconRules })).toEqual([])
  })
})
