// Final review I1: a carousel slide wholly outside its track is not cut-off text, and line-clamp draws its own ellipsis.
// Re-review: text inside a translated track (carousels, odometers) is a transform mask and is not checked.
import { afterAll, describe, expect, it } from 'vitest'
import { RULES } from '../src/rules'
import { runRules } from '../src/run'
import { page } from './fixtures'
import { closeBrowser, modelOf } from './helpers/browser'

afterAll(closeBrowser)

const ID = 'layout/clipped-text'
const found = async (html: string) => runRules(await modelOf(html), { rules: RULES.filter((r) => r.id === ID) }).map((f) => f.rule)
const LONG = 'هذا وصف طويل للمنتج يمتد على عدة أسطر ويجب أن يقطع بعد سطرين فقط لأن البطاقة صغيرة جدا'
const slide = (n: string) => `<div class="swiper-slide" style="width:300px;flex-shrink:0">الشريحة ${n}</div>`

describe('layout/clipped-text stays quiet on carousels and line-clamp', () => {
  it('a flex track of slides, the ones outside the box ignored', async () => {
    const body = `<div style="width:300px;overflow:hidden"><div style="display:flex;width:900px">${['الأولى', 'الثانية', 'الثالثة'].map(slide).join('')}</div></div>`
    expect(await found(page(body))).toEqual([])
  })
  it('a Swiper-style track moved with translate3d to the second slide', async () => {
    const body = `<div class="swiper" style="width:300px;overflow:hidden;position:relative"><div class="swiper-wrapper" style="display:flex;transform:translate3d(300px,0,0)">${['الأولى', 'الثانية', 'الثالثة'].map(slide).join('')}</div></div>`
    expect(await found(page(body))).toEqual([])
  })
  it('Tailwind line-clamp-2, with and without text-overflow', async () => {
    const clamp = 'overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2'
    expect(await found(page(`<p style="width:200px;${clamp}">${LONG}</p>`))).toEqual([])
    expect(await found(page(`<p style="width:200px;${clamp};text-overflow:ellipsis">${LONG}</p>`))).toEqual([])
    const m = await modelOf(page(`<p style="width:200px;${clamp}">${LONG}</p>`))
    expect(m.clips.every((c) => c.ellipsis)).toBe(true)
  })
})

// Re-review: a slide that peeks in at the edge of a translated track is masked on purpose, not cut off.
describe('layout/clipped-text stays quiet on a slide peeking in from a translated track', () => {
  const peek = (move: string) =>
    `<div style="width:300px;overflow:hidden"><div style="display:flex;gap:8px;width:max-content;${move}">` +
    '<div style="width:250px">عرض خاص على الحسابات</div><div style="width:250px">بطاقة ائتمانية جديدة للعملاء</div></div></div>'
  it.each([
    ['transform:translateX(50px)'],
    ['transform:translate3d(-40px,0,0)'],
    ['translate:30px'],
    ['transform:translate3d(0px,0px,0px)'],
  ])('%s', async (move) => {
    expect(await found(page(peek(move)))).toEqual([])
  })
  it('a slide straddling the edge of a track moved with translateX', async () => {
    const body = `<div style="width:300px;overflow:hidden"><div style="display:flex;width:900px;transform:translateX(50px)">${['الأولى', 'الثانية'].map(slide).join('')}</div></div>`
    expect(await found(page(body))).toEqual([])
  })
})

describe('layout/clipped-text still reports text cut at the edge', () => {
  it('a fixed-width Arabic button whose label runs past it', async () => {
    expect(await found(page('<button style="width:60px;overflow:hidden;white-space:nowrap">إضافة إلى السلة الآن</button>'))).toEqual([ID])
  })
  it('a fixed-width button that is itself translated, as a hover lift or Tailwind v3 transform does', async () => {
    expect(await found(page('<button style="width:60px;overflow:hidden;white-space:nowrap;transform:translateY(-2px)">إضافة إلى السلة الآن</button>'))).toEqual([ID])
    expect(await found(page('<button style="width:60px;overflow:hidden;white-space:nowrap;transform:translate(0,0)">إضافة إلى السلة الآن</button>'))).toEqual([ID])
  })
  it('a fixed-width label inside a rotated, not translated, box', async () => {
    expect(await found(page('<div style="transform:rotate(2deg)"><button style="width:60px;overflow:hidden;white-space:nowrap">إضافة إلى السلة الآن</button></div>'))).toEqual([ID])
  })
  it('a read-more box with max-height, as the known limits say', async () => {
    expect(await found(page(`<div style="max-height:48px;overflow:hidden;width:300px">${LONG} ${LONG}</div>`))).toEqual([ID])
  })
  it('a fixed-height box whose second line falls wholly below it, when the first line is inside', async () => {
    expect(await found(page(`<div style="height:27px;overflow:hidden;width:200px">${LONG}</div>`))).toEqual([ID])
  })
})
