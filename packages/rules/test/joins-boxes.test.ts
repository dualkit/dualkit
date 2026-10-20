// Final review C1: a word is split only when both sides sit in one inline formatting context and the boundary letters
// touch on one line. Separate boxes that React or minified HTML put side by side with no whitespace are not one word.
import { afterAll, describe, expect, it } from 'vitest'
import { RULES } from '../src/rules'
import { runRules } from '../src/run'
import { page } from './fixtures'
import { closeBrowser, modelOf, withPage } from './helpers/browser'

afterAll(closeBrowser)

const ID = 'type/arabic-broken-join'
const found = async (html: string) => runRules(await modelOf(html), { rules: RULES.filter((r) => r.id === ID) }).map((f) => f.rule)

/** True when the system font draws Arabic on this machine, measured against two generic fallbacks. */
const installed = (family: string) => withPage(page('<p>x</p>'), async (p) =>
  p.evaluate((f) => {
    const w = (fam: string) => { const e = document.createElement('span'); e.style.cssText = `position:absolute;white-space:pre;font:32px ${fam}`; e.textContent = 'محمد'; document.body.append(e); const r = e.getBoundingClientRect().width; e.remove(); return r }
    return w(`"${f}",monospace`) !== w('monospace') || w(`"${f}",serif`) !== w('serif')
  }, family))

describe('type/arabic-broken-join stays quiet across separate boxes with no whitespace between them', () => {
  it.each([
    ['inline-block nav links in inline list items, as React renders them', '<ul style="list-style:none;display:block"><li style="display:inline"><a href="#" style="display:inline-block;padding:8px">المنتجات</a></li><li style="display:inline"><a href="#" style="display:inline-block;padding:8px">العروض</a></li></ul>'],
    ['inline-block and inline-flex links in block list items', '<ul><li><a href="#" style="display:inline-block">المنتجات</a></li><li><a href="#" style="display:inline-flex">العروض</a></li></ul>'],
    ['table cells', '<table><tr><td><span style="display:inline-block">الاسم</span></td><td><span style="display:inline-block">محمد</span></td></tr></table>'],
    ['padded inline-flex tabs', '<div role="tablist"><a role="tab" style="display:inline-flex;padding:8px">الحسابات</a><a role="tab" style="display:inline-flex;padding:8px">البطاقات</a></div>'],
    ['a badge after a title', '<h3>منتج<span style="display:inline-flex;margin-inline-start:8px;background:#eee">جديد</span></h3>'],
    ['flex items in a row', '<div style="display:flex"><span>الحساب</span><span>محمد</span></div>'],
    ['an icon button with a screen-reader label', '<button style="width:40px;height:40px"><svg width="20" height="20"></svg><span style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border-width:0">القائمة الرئيسية</span></button>'],
    ['a Hijri heh with tatweel beside an inline-block label', '<p>1447 هـ<span style="display:inline-block">التاريخ</span></p>'],
  ])('%s', async (_name, body) => {
    expect((await modelOf(page(body))).joins).toEqual([])
    expect(await found(page(body))).toEqual([])
  })

  it.for([
    ['a heading then a paragraph', '<h2 style="font-family:\'Geeza Pro\'">مرحبا بكم</h2><p>نقدم لكم أفضل الخدمات</p>'],
    ['two adjacent divs', '<div><div style="font-family:\'Geeza Pro\'">الحساب</div><div>مرحبا</div></div>'],
  ] as const)('blocks in different fonts: %s', async ([, body], ctx) => {
    if (!(await installed('Geeza Pro'))) return ctx.skip('Geeza Pro is not installed on this machine')
    expect((await modelOf(page(body))).joins).toEqual([])
  })
})

describe('type/arabic-broken-join still reports a word split inside one line', () => {
  it.each([
    ['an unpadded inline-block', '<p>مح<span style="display:inline-block">مد</span></p>', 'inline-block'],
    ['an unpadded inline-flex', '<p>مح<span style="display:inline-flex">مد</span></p>', 'other'],
    ['an inline-block inside an inline span', '<p><span>مح</span><span><b style="display:inline-block">مد</b></span></p>', 'inline-block'],
  ])('%s', async (_name, body, reason) => {
    const joins = (await modelOf(page(body))).joins
    expect(joins).toHaveLength(1)
    expect(joins[0]).toMatchObject({ reason, word: 'محمد' })
  })

  it('stays quiet when the same word wraps across two lines at the box', async () => {
    const body = '<p style="width:60px">مممممم<span style="display:inline-block">مممممم</span></p>'
    expect((await modelOf(page(body))).joins).toEqual([])
  })
})
