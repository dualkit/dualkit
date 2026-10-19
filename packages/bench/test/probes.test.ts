import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type Browser } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readPng } from '../../cli/src/report/png'
import { cell } from '../src/cells'
import { loadScreens } from '../src/config'
import { extractHtml } from '../src/extract'
import { makeGenerate } from '../src/providers'
import { scoreHtml } from '../src/score'

const fixture = (n: string) => readFileSync(join(import.meta.dirname, 'fixtures', `${n}.html`), 'utf8')
const screens = loadScreens()
const screen = (id: string) => screens.find((s) => s.id === id)!
let browser: Browser
beforeAll(async () => { browser = await chromium.launch() })
afterAll(async () => { await browser.close() })

const page = (body: string) => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${body}</body></html>`
const missingFor = async (html: string, id: string) => {
  const out = await scoreHtml(html, screen(id).required, { browser })
  if (!out.ok) throw new Error(out.error)
  return out.missing
}

describe('probes: omission and required parts', () => {
  it('omission never beats an honest buggy build, on every screen', async () => {
    for (const s of screens) {
      const blank = await scoreHtml(fixture('incomplete'), s.required, { browser })
      if (!blank.ok) throw new Error('should score')
      expect(blank.missing.length, s.id).toBeGreaterThan(0)
      const c = cell([1, 2, 3].map((run) => ({ run, rulesPassed: blank.rulesPassed, score: blank.score, missing: blank.missing })))
      expect(c.ran && c.rulesPassed, s.id).toBe(0)
    }
  })
  it('each prompt\'s required parts accept a faithful build', async () => {
    for (const s of screens) expect(await missingFor(fixture(`faithful-${s.id}`), s.id), s.id).toEqual([])
  })
  it('Arabic-Indic digits in a faithful build still meet the required text', async () => {
    const html = fixture('faithful-profile').replace('+971', '+٩٧١')
    expect(html).toContain('+٩٧١')
    expect(await missingFor(html, 'profile')).toEqual([])
  })
  it('text hidden from the reader does not satisfy a required part', async () => {
    const html = page('<h1>الملف</h1><div style="display:none">AE07 0331 2345 6789 0123 456 +971 50 123 4567 layla@example.com</div>')
    expect((await missingFor(html, 'profile')).length).toBe(3)
  })
  it('a page that patches RegExp.test cannot fake the required parts', async () => {
    const html = page('<script>RegExp.prototype.test=()=>true;String.prototype.match=()=>[""]</script><h1>الملف</h1>')
    expect((await missingFor(html, 'profile')).length).toBe(3)
  })
})

describe('probes: Hijri dates', () => {
  const orders = (hijri: string) => page(
    ['A-10291', 'A-10292', 'A-10293', 'A-10294'].map((n) => `<p>${n}</p>`).join('') + hijri,
  )
  const hijriMissing = async (html: string) => (await missingFor(html, 'order-history')).includes('Hijri dates')
  it('a page whose only ه is in هذه is reported missing Hijri dates', async () => {
    expect(await hijriMissing(orders('<p>هذه طلباتك</p>'))).toBe(true)
  })
  it.each(['1447 ه', '١٤٤٨ هـ', '12 ه', '3 ربيع الأول 1447'])('accepts %s', async (text) => {
    expect(await hijriMissing(orders(`<p>${text}</p>`))).toBe(false)
  })
})

describe('probes: extraction and render', () => {
  it('a reply with an explanation block and a full page picks the page', () => {
    const full = fixture('good')
    const reply = 'Notes:\n```html\n<!-- use this snippet -->\n<button>x</button>\n```\nFull file:\n```html\n' + full + '\n```'
    expect(extractHtml(reply)).toBe(full.trim())
  })
  it('the render is 390 css px wide, the phone width', async () => {
    const out = await scoreHtml(fixture('good'), [], { browser })
    if (!out.ok) throw new Error('should score')
    expect([390, 780]).toContain(readPng(out.screenshot)!.width)
  })
})

describe('probes: retries respect the run deadline', () => {
  const or = { id: 'm', provider: 'openrouter', model: 'x/y', label: 'M', since: '2026-01', by: 'X', mark: 'x' } as const
  const req = { system: 's', prompt: 'p' }
  const flaky = () => {
    const calls: number[] = []
    const f = (async () => { calls.push(1); return new Response('boom', { status: 500 }) }) as unknown as typeof fetch
    return { f, calls }
  }
  it('starts no retry once the deadline has passed and returns the last error at once', async () => {
    let clock = 0
    const waits: number[] = []
    const { f, calls } = flaky()
    const gen = makeGenerate({ env: { OPENROUTER_API_KEY: 'k' }, fetch: f, sleep: async (ms) => { waits.push(ms); clock += ms }, now: () => clock, deadline: 5_000 })
    clock = 6_000
    const out = await gen(or, req)
    expect(out).toMatchObject({ ok: false, error: expect.stringContaining('HTTP 500') })
    expect(calls).toHaveLength(1)
    expect(waits.filter((w) => w >= 10_000)).toEqual([])
  })
  it('still retries while the deadline is ahead', async () => {
    let clock = 0
    const { f, calls } = flaky()
    const gen = makeGenerate({ env: { OPENROUTER_API_KEY: 'k' }, fetch: f, sleep: async (ms) => { clock += ms }, now: () => clock, deadline: 1_000_000 })
    await gen(or, req)
    expect(calls).toHaveLength(3)
  })
  it('stops retrying when the backoff itself carries the clock past the deadline', async () => {
    let clock = 0
    const { f, calls } = flaky()
    const gen = makeGenerate({ env: { OPENROUTER_API_KEY: 'k' }, fetch: f, sleep: async (ms) => { clock += ms }, now: () => clock, deadline: 5_000 })
    await gen(or, req)
    expect(calls).toHaveLength(1)
  })
})
