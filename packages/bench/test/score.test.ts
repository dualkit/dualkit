import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type Browser } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadScreens } from '../src/config'
import { RULE_COUNT, scoreHtml } from '../src/score'

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
})
