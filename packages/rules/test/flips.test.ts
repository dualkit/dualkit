// Final review C2: a flip is decided from the determinant of the transform (a·d − b·c < 0), so rotate(180deg) and
// scale(-1,-1), which turn without mirroring, are not flips. Mirrored text counts only for runs with Arabic letters.
import { afterAll, describe, expect, it } from 'vitest'
import { RULES } from '../src/rules'
import { runRules } from '../src/run'
import { page } from './fixtures'
import { closeBrowser, modelOf, withPage } from './helpers/browser'

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

// Re-review: a flip card's back face sits under rotateY(180deg) with backface-visibility:hidden. Until the card turns,
// Chromium does not paint it, so it is not mirrored text. Once the card turns, the front face is the hidden one.
const FRONT = 'الوجه الأمامي'
const BACK = 'الوجه الخلفي'
const card = (turn: string, preserve = 'transform-style:preserve-3d;') =>
  `<div style="perspective:600px"><div id="card" style="position:relative;${preserve}width:200px;height:100px;${turn}">` +
  `<div style="position:absolute;inset:0;backface-visibility:hidden;color:#f00;font-size:24px">${FRONT}</div>` +
  `<div style="position:absolute;inset:0;backface-visibility:hidden;transform:rotateY(180deg);color:#00f;font-size:24px">${BACK}</div></div></div>`

/** Pixels of the red front face and the blue back face that Chromium paints inside the card. */
async function facesPainted(html: string) {
  return withPage(html, async (p) => {
    const shot = (await p.locator('#card').screenshot()).toString('base64')
    return p.evaluate(async (d) => {
      const im = new Image()
      im.src = `data:image/png;base64,${d}`
      await im.decode()
      const c = document.createElement('canvas')
      c.width = im.width
      c.height = im.height
      const x = c.getContext('2d')!
      x.drawImage(im, 0, 0)
      const px = x.getImageData(0, 0, c.width, c.height).data
      let front = 0
      let back = 0
      for (let i = 0; i < px.length; i += 4) {
        if (px[i]! > 150 && px[i + 2]! < 100) front++
        if (px[i + 2]! > 150 && px[i]! < 100) back++
      }
      return { front, back }
    }, shot)
  })
}

describe('layout/mirrored-text on a flip card', () => {
  it('Chromium paints only the front face of an unturned card, and only the back face of a turned one', async () => {
    const still = await facesPainted(page(card('')))
    const turned = await facesPainted(page(card('transform:rotateY(180deg)')))
    expect(still.front).toBeGreaterThan(50)
    expect(still.back).toBe(0)
    expect(turned.front).toBe(0)
    expect(turned.back).toBeGreaterThan(50)
  })
  it('stays quiet on the hidden back face of a card that has not turned', async () => {
    expect(await found(page(card('')), MIRRORED)).toEqual([])
  })
  it('stays quiet on a turned card, whose back face is counter-rotated and whose front face is hidden', async () => {
    expect(await found(page(card('transform:rotateY(180deg)')), MIRRORED)).toEqual([])
  })
  it('still reports a back face mirrored without backface-visibility:hidden', async () => {
    const shown = `<div style="transform:rotateY(180deg)"><p>${BACK}</p></div>`
    expect(await found(page(shown), MIRRORED)).toEqual([MIRRORED])
  })
})
