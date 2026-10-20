// Final review I1: a carousel slide wholly outside its track is not cut-off text, and line-clamp draws its own ellipsis.
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

describe('layout/clipped-text still reports text cut at the edge', () => {
  it('a slide whose text straddles the edge of the box', async () => {
    const body = `<div style="width:300px;overflow:hidden"><div style="display:flex;width:900px;transform:translateX(50px)">${['الأولى', 'الثانية'].map(slide).join('')}</div></div>`
    expect(await found(page(body))).toEqual([ID])
  })
  it('a read-more box with max-height, as the known limits say', async () => {
    expect(await found(page(`<div style="max-height:48px;overflow:hidden;width:300px">${LONG} ${LONG}</div>`))).toEqual([ID])
  })
  it('a fixed-height box whose second line falls wholly below it, when the first line is inside', async () => {
    expect(await found(page(`<div style="height:27px;overflow:hidden;width:200px">${LONG}</div>`))).toEqual([ID])
  })
})
