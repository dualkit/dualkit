import { RULES } from '@dualkit/rules'
import { describe, expect, it } from 'vitest'
import { MAX_HTML_BYTES } from '../src/tools/check-html'
import { expectPlainError, json, useClient } from './helpers'

const { call } = useClient()

type Out = {
  findings: { rule: string; severity: string; message: string; fix: string; docs: string; node: { id: string; snippet: string } | null }[]
  checked: string[]
  notChecked: { rule: string; reason: string }[]
}

const page = (body: string, attrs = 'lang="ar" dir="rtl"') => `<!doctype html><html ${attrs}><head><title>t</title></head><body>${body}</body></html>`
const check = async (html: string) => json(await call('check_html', { html })) as Out
const rules = (out: Out) => out.findings.map((f) => f.rule)

describe('check_html', () => {
  it('finds a phone number that is not isolated in Arabic text', async () => {
    const out = await check(page('<p>اتصل على <span>050 123 4567</span> اليوم</p>'))
    const finding = out.findings.find((f) => f.rule === 'bidi/unisolated-number')
    expect(finding).toMatchObject({ severity: 'error', node: { id: expect.any(String), snippet: '<span>050 123 4567</span>' } })
    expect(finding?.docs).toMatch(/RULES\.md#bidi-unisolated-number$/)
  })

  it('passes the same number inside <bdi>', async () => {
    expect(rules(await check(page('<p>اتصل على <bdi>050 123 4567</bdi> اليوم</p>')))).not.toContain('bidi/unisolated-number')
  })

  it('reads direction from dir on an ancestor and from CSS', async () => {
    const out = await check(page('<style>.ar{direction:rtl}</style><div class="ar"><p>اتصل على 050 123 4567 اليوم</p></div>', 'lang="ar"'))
    expect(rules(out)).toContain('bidi/unisolated-number')
  })

  it('resolves dir="auto" from the first strong letter', async () => {
    const out = await check(page('<p dir="auto">اتصل على 050 123 4567</p><p dir="auto">Call 050 123 4567</p><input dir="auto" type="tel" value="Tel">', 'lang="ar"'))
    expect(out.findings.filter((f) => f.rule === 'bidi/unisolated-number')).toHaveLength(1)
  })

  it('finds a page with no lang, an Arabic page that runs left to right, and Arabic tagged English', async () => {
    const out = await check('<p>مرحبا بكم في الموقع الجديد اليوم</p><p lang="en">مرحبا بكم في الموقع</p>')
    expect(rules(out)).toEqual(expect.arrayContaining(['content/missing-lang', 'content/missing-dir', 'content/lang-mismatch', 'layout/arabic-ltr-block']))
  })

  it('finds an email field that inherits right to left', async () => {
    expect(rules(await check(page('<label>البريد <input type="email" name="email"></label>')))).toContain('bidi/field-direction')
  })

  it('leaves out text that is not displayed', async () => {
    const out = await check(page('<style>.gone{display:none}</style><div class="gone"><p>اتصل على 050 123 4567</p></div><p hidden>اتصل 050 123 4567</p>'))
    expect(rules(out)).not.toContain('bidi/unisolated-number')
  })

  it('reads a word split across elements without measuring it', async () => {
    const out = await check(page('<p style="font-family:serif">كت<b style="display:inline-block;font-family:sans-serif">ب</b></p>'))
    expect(out.notChecked.map((n) => n.rule)).toContain('type/arabic-broken-join')
    expect(rules(out)).not.toContain('type/arabic-broken-join')
  })

  it('never runs the page\'s scripts', async () => {
    const out = await check(page('<p id="x">مرحبا</p><script>document.getElementById("x").textContent = "اتصل على 050 123 4567"</script>'))
    expect(rules(out)).not.toContain('bidi/unisolated-number')
  })

  it('accounts for every rule as checked or not checked, with a reason for each one left out', async () => {
    const out = await check(page('<p>مرحبا</p>'))
    expect([...out.checked, ...out.notChecked.map((n) => n.rule)].sort()).toEqual(RULES.map((r) => r.id).sort())
    for (const n of out.notChecked) expect(n.reason).toMatch(/^[A-Z].*\.$/)
    expect(out.notChecked.map((n) => n.rule)).toEqual(expect.arrayContaining(['layout/clipped-text', 'type/arabic-font', 'content/drops-arabic-digits']))
  })

  it('reports only rules it checked', async () => {
    const out = await check(page('<p style="letter-spacing:2px;font-style:italic">نص عربي طويل هنا</p>'))
    for (const f of out.findings) expect(out.checked).toContain(f.rule)
  })

  it('leaves the made-up layout box out of findings', async () => {
    const out = await check(page('<p>اتصل على <span>050 123 4567</span></p>'))
    for (const f of out.findings) if (f.node) expect(Object.keys(f.node).sort()).toEqual(['id', 'snippet'])
  })

  it('refuses HTML over the size cap with a plain sentence', async () => {
    const html = page(`<p>${'a'.repeat(MAX_HTML_BYTES)}</p>`)
    expect(expectPlainError(await call('check_html', { html }))).toMatch(/2 MB/)
  })

  it('needs some HTML', async () => {
    expect(expectPlainError(await call('check_html', { html: '  ' }))).toMatch(/HTML/)
    expect(expectPlainError(await call('check_html', {}))).toMatch(/html/)
  })
})
