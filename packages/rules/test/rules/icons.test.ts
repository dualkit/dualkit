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

describe('icons/arrow-points-forward', () => {
  const arrow = (p: Parameters<typeof icon>[0]) => icon({ name: null, ...p })
  it('flags a back arrow whose head points left in RTL', () => {
    expect(ids(screen({ icons: [arrow({ role: 'back', head: 'left' })] }))).toEqual(['icons/arrow-points-forward'])
  })
  it('passes a back arrow whose head points right in RTL', () => {
    expect(ids(screen({ icons: [arrow({ role: 'back', head: 'right' })] }))).toEqual([])
  })
  it('flags a forward arrow whose head points right in RTL', () => {
    expect(ids(screen({ icons: [arrow({ role: 'forward', head: 'right' })] }))).toEqual(['icons/arrow-points-forward'])
  })
  it('passes a forward arrow whose head points left in RTL', () => {
    expect(ids(screen({ icons: [arrow({ role: 'forward', head: 'left' })] }))).toEqual([])
  })
  it('stays quiet without a role, without a head, or in LTR', () => {
    expect(ids(screen({ icons: [arrow({ role: null, head: 'left' }), arrow({ role: 'back', head: null }), arrow({ role: 'back', head: 'left', dir: 'ltr' })] }))).toEqual([])
  })
  it('is an error', () => {
    expect(runRules(screen({ icons: [arrow({ role: 'back', head: 'left' })] }), { rules: iconRules })[0]!.severity).toBe('error')
  })
  it('reports only arrow-points-forward when not-mirrored would fire on the same icon', () => {
    expect(ids(screen({ icons: [icon({ name: 'arrow-left', role: 'back', head: 'left' })] }))).toEqual(['icons/arrow-points-forward'])
    expect(ids(screen({ icons: [icon({ name: 'arrow-left', role: 'back', head: 'right' })] }))).toEqual(['icons/not-mirrored'])
  })
})

describe('the drawn head of an icon in a real browser', () => {
  const heads = async (body: string, o?: Parameters<typeof page>[1]) =>
    (await modelOf(page(body, o))).icons.map((i) => [i.role, i.head])
  const left = '<svg width="20" height="20" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>'
  const right = '<svg width="20" height="20" viewBox="0 0 24 24"><path d="m 9 18 6 -6 -6 -6"/></svg>'
  it('reads the role from the control and the head from the path', async () => {
    expect(await heads(`<button aria-label="رجوع">${left}</button><button aria-label="التالي">${right}</button><button>${right}</button>`))
      .toEqual([['back', 'left'], ['forward', 'right'], [null, 'right']])
  })
  it('reads the role from class, id and title, and from the icon itself', async () => {
    expect(await heads(`<a class="back-link" href="#">${left}</a><button id="nextMonth">${left}</button><button title="السابق">${left}</button>${left.replace('<svg', '<svg class="icon-back"')}`))
      .toEqual([['back', 'left'], ['forward', 'left'], ['back', 'left'], ['back', 'left']])
  })
  it('turns the head with CSS flips and turns on the icon and its ancestors', async () => {
    expect(await heads(
      `<button style="transform:scaleX(-1)">${left}</button>${left.replace('<svg', '<svg style="transform:rotate(180deg)"')}` +
      `<div style="transform:scaleX(-1)"><span style="transform:scaleX(-1)">${left}</span></div>${left.replace('<svg', '<svg style="transform:rotate(90deg)"')}`,
    )).toEqual([[null, 'right'], [null, 'right'], [null, 'left'], [null, null]])
  })
  it('turns the head with SVG transforms inside the icon', async () => {
    expect(await heads(left.replace('<path', '<path transform="scale(-1 1) translate(-24 0)"') + right.replace('<path', '<g transform="rotate(180 12 12)"><path').replace('</svg>', '</g></svg>')))
      .toEqual([[null, 'right'], [null, 'left']])
  })
  it('reads polylines and filled triangles', async () => {
    expect(await heads('<svg width="20" height="20" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg><svg width="20" height="20" viewBox="0 0 24 24"><polygon points="16 4 8 12 16 20"/></svg>'))
      .toEqual([[null, 'right'], [null, 'left']])
  })
  it('reads no head from an icon that is not an arrow', async () => {
    expect(await heads('<svg width="20" height="20" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>')).toEqual([[null, null]])
  })
  it('treats an arrow glyph in a button or link as an icon, mirrored by bidi where Unicode says so', async () => {
    const m = await modelOf(page('<a aria-label="السابق" href="#">←</a><button aria-label="الشهر السابق">›</button><button aria-label="رجوع">‹</button><a href="#">«اقرأ المزيد»</a><p>→</p>'))
    expect(m.icons.map((i) => [i.name, i.role, i.head])).toEqual([[null, 'back', 'left'], [null, 'back', 'left'], [null, 'back', 'right']])
  })
  it('reads a glyph in LTR without the bidi mirror', async () => {
    expect(await heads('<a aria-label="Back" href="#">‹</a>', { lang: 'en', dir: 'ltr' })).toEqual([['back', 'left']])
  })
})

describe('icons/arrow-points-forward in a real browser', () => {
  const found = async (html: string) => runRules(await modelOf(html), { rules: iconRules }).map((f) => f.rule)
  it('reports the arrow and not the button around it', async () => {
    const f = runRules(await modelOf(page('<button aria-label="رجوع"><svg viewBox="0 0 24 24" width="20" height="20"><path d="m15 18-6-6 6-6"/></svg></button>')), { rules: iconRules })
    expect(f.map((x) => x.rule)).toEqual(['icons/arrow-points-forward'])
    expect(f[0]!.node!.snippet.startsWith('<svg')).toBe(true)
  })
  it('stays quiet on an English page with a left back arrow', async () => {
    expect(await found(page('<button aria-label="Back"><svg viewBox="0 0 24 24" width="20" height="20"><path d="m15 18-6-6 6-6"/></svg></button><a aria-label="Back" href="#">←</a>', { lang: 'en', dir: 'ltr' }))).toEqual([])
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
    const html = page('<button aria-label="Next"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M11 2l-6 6 6 6"/></svg></button>')
    const found = runRules(await modelOf(html), { rules: iconRules }).map((f) => f.rule)
    expect(found).toEqual(['icons/not-mirrored'])
  })
  it('leaves a right-pointing Next chevron to arrow-points-forward, and passes it once mirrored', async () => {
    const html = page('<button aria-label="Next"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M5 2l6 6-6 6"/></svg></button>')
    expect(runRules(await modelOf(html), { rules: iconRules }).map((f) => f.rule)).toEqual(['icons/arrow-points-forward'])
    expect(runRules(await modelOf(html.replace('<svg', '<svg style="transform:scaleX(-1)"')), { rules: iconRules })).toEqual([])
  })
  // Drawn pointing left, the way a next chevron points in RTL, so only the name decides whether not-mirrored fires.
  const chevron = '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M11 2l-6 6 6 6"/></svg>'
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
