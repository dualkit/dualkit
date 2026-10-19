import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type Browser } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadScreens } from '../src/config'
import { RULE_COUNT, missingParts, scoreHtml } from '../src/score'

const fixture = (name: string) => readFileSync(join(import.meta.dirname, 'fixtures', `${name}.html`), 'utf8')
const payment = loadScreens().find((s) => s.id === 'payment-summary')!
let browser: Browser
beforeAll(async () => { browser = await chromium.launch() })
afterAll(async () => { await browser.close() })

describe('scoreHtml', () => {
  it('scores a good build high with nothing missing', async () => {
    const out = await scoreHtml(fixture('good'), payment.required, { browser })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.missing).toEqual([])
    expect(out.rulesPassed).toBeGreaterThanOrEqual(RULE_COUNT - 2)
    expect(out.screenshot.length).toBeGreaterThan(1000)
  })
  it('scores a buggy build lower than the good one', async () => {
    const good = await scoreHtml(fixture('good'), payment.required, { browser })
    const bad = await scoreHtml(fixture('buggy'), payment.required, { browser })
    if (!good.ok || !bad.ok) throw new Error('both should score')
    expect(bad.rulesPassed).toBeLessThan(good.rulesPassed)
    expect(bad.findings.every((f) => typeof f.rule === 'string')).toBe(true)
  })
  it('names every missing part of a one-line page', async () => {
    const out = await scoreHtml(fixture('incomplete'), payment.required, { browser })
    if (!out.ok) throw new Error('should score')
    expect(out.missing).toEqual(['phone field', 'amount', 'pay button'])
  })
  it('scores a page with a hung image and a throwing script, within the audit timeouts', async () => {
    const started = Date.now()
    const out = await scoreHtml(fixture('hang'), payment.required, { browser })
    expect(out.ok).toBe(true)
    expect(Date.now() - started).toBeLessThan(60_000)
  })
  it('counts a selector with min', async () => {
    const out = await scoreHtml('<!doctype html><html dir="rtl"><body><input><input></body></html>', [{ label: 'four', selector: 'input', min: 4 }], { browser })
    if (!out.ok) throw new Error('should score')
    expect(out.missing).toEqual(['four'])
  })
  it('cannot be fooled by a page that overrides its own DOM and RegExp methods', async () => {
    // Checked on missingParts directly: the audit itself reports ok:false for a page that breaks querySelectorAll.
    const page = await browser.newPage()
    try {
      await page.setContent('<!doctype html><html lang="ar" dir="rtl"><body><p>مرحبا</p><script>Document.prototype.querySelectorAll = () => ({ length: 99 }); RegExp.prototype.test = () => true; Object.defineProperty(HTMLElement.prototype, "innerText", { get: () => "ملخص الدفع 1,234.50" })</script></body></html>')
      expect(await missingParts(page, payment.required)).toEqual(['phone field', 'amount', 'pay button'])
    } finally {
      await page.close()
    }
  })
  it('returns ok:false instead of throwing when the browser cannot launch', async () => {
    const out = await scoreHtml('<p>x</p>', [], { launch: async () => { throw new Error('no chromium') } })
    expect(out).toEqual({ ok: false, error: 'no chromium' })
  })
  it('gives up on a page that busy-loops after load', async () => {
    const started = Date.now()
    const out = await scoreHtml('<!doctype html><html dir="rtl"><body><p>x</p><script>setTimeout(() => { for(;;){} }, 0)</script></body></html>', [], { browser, deadlineMs: 15_000 })
    expect(out).toEqual({ ok: false, error: 'Scoring timed out' })
    expect(Date.now() - started).toBeLessThan(20_000)
  }, 30_000)
})
