import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type Browser } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadScreens } from '../src/config'
import { RULE_COUNT, missingParts, normaliseText, scoreHtml } from '../src/score'

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
    expect(out.unreadableStylesheets).toBe(0)
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

const cp = (...codes: number[]) => String.fromCharCode(...codes)
const screens = loadScreens()

describe('normaliseText', () => {
  it('turns Arabic-Indic and Persian digits into ASCII', () => {
    expect(normaliseText(cp(0x0660, 0x0661, 0x0669) + ' ' + cp(0x06f0, 0x06f4, 0x06f9))).toBe('019 049')
  })
  it('strips bidi controls and isolates', () => {
    const controls = [0x200e, 0x200f, 0x061c, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069]
    expect(normaliseText(controls.map((c) => cp(c) + 'x').join(''))).toBe('x'.repeat(controls.length))
  })
  it('turns the Arabic thousands and decimal separators into a comma and a point', () => {
    expect(normaliseText(cp(0x0661, 0x066c, 0x0662, 0x0663, 0x0664, 0x066b, 0x0665, 0x0660))).toBe('1,234.50')
  })
})

describe('required parts accept faithful Arabic builds', () => {
  const names = readdirSync(join(import.meta.dirname, 'fixtures')).filter((n) => n.startsWith('faithful-')).map((n) => n.replace(/\.html$/, ''))
  it('has one faithful page per screen, plus the variants', () => {
    for (const s of screens) expect(names).toContain(`faithful-${s.id}`)
    expect(names).toEqual(expect.arrayContaining(['faithful-order-history-indic', 'faithful-profile-inputs']))
  })
  for (const name of names) {
    it(`${name} misses nothing`, async () => {
      const screen = screens.find((s) => name === `faithful-${s.id}` || name.startsWith(`faithful-${s.id}-`))!
      const page = await browser.newPage()
      try {
        await page.setContent(fixture(name))
        expect(await missingParts(page, screen.required)).toEqual([])
      } finally {
        await page.close()
      }
    })
  }
  it('reads values in read-only inputs through the full scoring path', async () => {
    const profile = screens.find((s) => s.id === 'profile')!
    const out = await scoreHtml(fixture('faithful-profile-inputs'), profile.required, { browser })
    if (!out.ok) throw new Error(out.error)
    expect(out.missing).toEqual([])
  })
  it('accepts every common way of marking a Hijri date, and nothing else', () => {
    const hijri = new RegExp(screens.find((s) => s.id === 'order-history')!.required.find((p) => p.label === 'Hijri dates')!.text!)
    const h = cp(0x0647), tatweel = cp(0x0640)
    for (const t of [`12 ${h}${tatweel}`, `12 ${h}`, `12 ${h} - 3`, 'هجري', '1448', '1447']) expect(hijri.test(normaliseText(t)), t).toBe(true)
    expect(hijri.test('12 أكتوبر 2026')).toBe(false)
    expect(hijri.test('هذا')).toBe(false)
  })
  it('counts only rules with a warning or error as failed', async () => {
    const out = await scoreHtml('<!doctype html><html lang="ar" dir="rtl"><head><style>body{font-family:"Noto Naskh Arabic",sans-serif}.a{margin-left:12px}</style></head><body><div style="display:flex"><p>مرحبا</p><p class="a">أهلا</p></div></body></html>', [], { browser })
    if (!out.ok) throw new Error('should score')
    expect(out.findings.every((f) => f.severity === 'note')).toBe(true)
    expect(out.findings.length).toBeGreaterThan(0)
    expect(out.rulesPassed).toBe(RULE_COUNT)
  })
  it('keeps message, fix, snippet and page text', async () => {
    const out = await scoreHtml(fixture('buggy'), payment.required, { browser })
    if (!out.ok) throw new Error('should score')
    const withNode = out.findings.find((f) => f.box !== null)!
    expect(withNode.message.length).toBeGreaterThan(0)
    expect(withNode.fix.length).toBeGreaterThan(0)
    expect(typeof withNode.snippet).toBe('string')
    expect(out.text.length).toBeGreaterThan(0)
  })
})
