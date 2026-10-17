import { afterAll, describe, expect, it } from 'vitest'
import { RULES } from '../src/rules'
import { runRules } from '../src/run'
import { page } from './fixtures'
import { closeBrowser, modelOf } from './helpers/browser'

afterAll(closeBrowser)

const ruleIds = async (html: string, id: string) =>
  runRules(await modelOf(html), { rules: RULES.filter((r) => r.id === id) }).map((f) => f.rule)

const ARABIC_LABEL = 'العربية'

describe('near misses in a real browser', () => {
  it('layout/arabic-ltr-block stays quiet on a language switcher in an English page', async () => {
    const html = page(`<ul><li><a href="/en">English</a></li><li><a href="/ar" lang="ar">${ARABIC_LABEL}</a></li></ul><p>Welcome to the shop.</p>`, { lang: 'en', dir: 'ltr' })
    expect(await ruleIds(html, 'layout/arabic-ltr-block')).toEqual([])
  })

  it('layout/text-align-left stays quiet on Latin text in an RTL element', async () => {
    const html = page('<p class="code">ORDER-2041</p>', { css: '.code{text-align:left}' })
    expect(await ruleIds(html, 'layout/text-align-left')).toEqual([])
  })

  it('layout/physical-inset catches left:0 and stays quiet on a centred element', async () => {
    const css = '.wrap{position:relative;height:100px}.a{position:absolute;top:0;left:0}.b{position:absolute;top:40px;left:50%;transform:translateX(-50%)}'
    const found = runRules(await modelOf(page('<div class="wrap"><span class="a">أ</span><span class="b">ب</span></div>', { css })), { rules: RULES.filter((r) => r.id === 'layout/physical-inset') })
    expect(found).toHaveLength(1)
    expect(found[0]?.node?.id).toContain('span.a')
  })
})
