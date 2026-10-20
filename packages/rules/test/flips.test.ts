// Final review C2: a flip is decided from the determinant of the transform (a·d − b·c < 0), so rotate(180deg) and
// scale(-1,-1), which turn without mirroring, are not flips. Mirrored text counts only for runs with Arabic letters.
import { afterAll, describe, expect, it } from 'vitest'
import { RULES } from '../src/rules'
import { runRules } from '../src/run'
import { page } from './fixtures'
import { closeBrowser, modelOf } from './helpers/browser'

afterAll(closeBrowser)

const found = async (html: string, id: string) => runRules(await modelOf(html), { rules: RULES.filter((r) => r.id === id) }).map((f) => f.rule)
const MIRRORED = 'layout/mirrored-text'
const TEXT = 'مرحبا بكم'

describe('layout/mirrored-text stays quiet on glyphs and turns that are not mirrored Arabic', () => {
  it.each([
    ['an arrow glyph flipped with scaleX(-1)', '<a href="#">عرض الكل <span style="display:inline-block;transform:scaleX(-1)">→</span></a>'],
    ['a material-icons ligature flipped as mat-icon-rtl-mirror does', '<button aria-label="التالي"><span class="material-icons" style="display:inline-block;transform:scaleX(-1)">arrow_forward</span></button>'],
    ['a chevron turned with rotate(180deg)', '<button>المزيد <span style="display:inline-block;transform:rotate(180deg)">⌄</span></button>'],
    ['Arabic turned with rotate(180deg)', `<p style="transform:rotate(180deg)">${TEXT}</p>`],
    ['Arabic turned with scale(-1,-1)', `<p style="transform:scale(-1,-1)">${TEXT}</p>`],
    ['Arabic turned with the rotate property', `<p style="rotate:180deg">${TEXT}</p>`],
    ['Arabic under a uniform scale:-1', `<p style="scale:-1">${TEXT}</p>`],
  ])('%s', async (_name, body) => {
    expect(await found(page(body), MIRRORED)).toEqual([])
  })
})

describe('layout/mirrored-text still reports mirrored Arabic', () => {
  it.each([
    ['scaleX(-1)', `<p style="transform:scaleX(-1)">${TEXT}</p>`],
    ['scale:-1 1', `<p style="scale:-1 1">${TEXT}</p>`],
    ['Tailwind v4 -scale-x-100', `<p style="scale:-100% 100%">${TEXT}</p>`],
    ['rotateY(180deg)', `<p style="transform:rotateY(180deg)">${TEXT}</p>`],
    ['scaleY(-1)', `<p style="transform:scaleY(-1)">${TEXT}</p>`],
    ['a flip on a parent with a rotate(180deg) on the text', `<div style="transform:scaleX(-1)"><p style="transform:rotate(180deg)">${TEXT}</p></div>`],
  ])('%s', async (_name, body) => {
    expect(await found(page(body), MIRRORED)).toEqual([MIRRORED])
  })
})

describe('icons read flips and turns apart', () => {
  const chevron = (style: string) => `<svg data-icon="chevron-right" style="${style}" width="16" height="16" viewBox="0 0 16 16"><path d="M6 4l4 4-4 4"/></svg>`
  it('reads scaleX(-1) as mirrored, and rotate(180deg), the rotate property and scale(-1,-1) as turned', async () => {
    const m = await modelOf(page(['transform:scaleX(-1)', 'transform:rotate(180deg)', 'rotate:180deg', 'transform:scale(-1,-1)', ''].map(chevron).join('')))
    expect(m.icons.map((i) => [i.mirrored, i.turned])).toEqual([[true, false], [false, true], [false, true], [false, true], [false, false]])
  })
  it('icons/not-mirrored passes a directional icon turned with rotate(180deg), as Tailwind rtl:rotate-180 does', async () => {
    expect(await found(page(chevron('transform:rotate(180deg)')), 'icons/not-mirrored')).toEqual([])
    expect(await found(page(chevron('rotate:180deg')), 'icons/not-mirrored')).toEqual([])
    expect(await found(page(chevron('')), 'icons/not-mirrored')).toEqual(['icons/not-mirrored'])
  })
  it('icons/mirrored-by-mistake still reports a flipped play icon, and not one that is only turned', async () => {
    const play = (style: string) => `<svg data-icon="play" style="${style}" width="16" height="16" viewBox="0 0 16 16"><path d="M4 2l10 6-10 6z"/></svg>`
    expect(await found(page(play('transform:scaleX(-1)')), 'icons/mirrored-by-mistake')).toEqual(['icons/mirrored-by-mistake'])
    expect(await found(page(play('transform:rotate(180deg)')), 'icons/mirrored-by-mistake')).toEqual([])
  })
})
