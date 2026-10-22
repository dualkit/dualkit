import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import { review } from '../../src/review'
import type { Answer, Ask } from '../../src/review/model'
import { result } from '../helpers'

const MODEL = { provider: 'gemini', model: 'm' } as const
const png = (w: number, h: number): string => PNG.sync.write(new PNG({ width: w, height: h })).toString('base64')
const run = { id: 'p', snippet: '<p class="d">٢٠٢٦/١٠/٢٢</p>', box: { x: 20, y: 30, width: 80, height: 20 }, text: '٢٠٢٦/١٠/٢٢', blockHasArabic: true }
const screen = { root: { lang: 'ar', dir: 'rtl', computedDir: 'rtl' }, texts: [run], layouts: [], icons: [], fields: [], fonts: [], labels: [], clips: [], joins: [], unreadableStylesheets: 0, viewportWidth: 1280 }
const audited = (extra = {}) => ({ ...result([], { screenshot: png(2560, 3200), pageHeight: 1600, height: 800 }), tags: {}, screen, ...extra }) as never

const fake = (reply: (n: number, ask: Ask) => Answer) => {
  const asks: Ask[] = []
  return { asks, vision: async (_m: unknown, ask: Ask) => reply(asks.push(ask) - 1, ask) }
}
const found = '{"findings":[{"rule":"review/date-reads-wrong","element":0,"message":"The year comes first.","confidence":0.9}]}'

describe('review', () => {
  it('finds, then keeps only what reflection confirms, with its confidence', async () => {
    const f = fake((n) => ({ ok: true, costUsd: 0.01, text: n === 0 ? found : '{"confirmed": true, "confidence": 0.8}' }))
    const out = await review(audited(), { source: '<p class="d">x</p>\n', vision: f.vision, model: MODEL, log: () => {} })
    expect(out.skipped).toBeNull()
    expect(out.findings).toHaveLength(1)
    expect(out.findings[0]).toMatchObject({ source: 'review', severity: 'warning', confidence: 0.8, line: 1 })
    expect(out.spentUsd).toBeCloseTo(0.02)
    expect(f.asks[1]!.images).toHaveLength(1)
  })

  it('drops a finding that reflection does not confirm', async () => {
    const f = fake((n) => ({ ok: true, costUsd: 0, text: n === 0 ? found : '{"confirmed": true, "confidence": 0.5}' }))
    expect((await review(audited(), { source: null, vision: f.vision, model: MODEL, log: () => {} })).findings).toEqual([])
  })

  it('gives line null for a URL target', async () => {
    const f = fake((n) => ({ ok: true, costUsd: 0, text: n === 0 ? found : '{"confirmed": true, "confidence": 0.9}' }))
    expect((await review(audited(), { source: null, vision: f.vision, model: MODEL, log: () => {} })).findings[0]!.line).toBeNull()
  })

  it('is skipped with the reason when the model call fails', async () => {
    const f = fake(() => ({ ok: false, error: 'No GEMINI_API_KEY' }))
    expect(await review(audited(), { source: null, vision: f.vision, model: MODEL, log: () => {} })).toEqual({ findings: [], spentUsd: 0, skipped: 'No GEMINI_API_KEY', unchecked: 0 })
  })

  it('reflects one finding at a time, in order', async () => {
    const two = JSON.stringify({ findings: [0, 0].map((element) => ({ rule: 'review/date-reads-wrong', element, message: 'm', confidence: 0.9 })) })
    let open = 0
    let overlap = false
    const vision = async (_m: unknown, ask: Ask): Promise<Answer> => {
      if (ask.images.length === 1) { open++; overlap ||= open > 1; await new Promise((r) => setTimeout(r, 5)); open-- }
      return { ok: true, costUsd: 0, text: ask.images.length === 1 ? '{"confirmed": true, "confidence": 0.9}' : two }
    }
    await review(audited(), { source: null, vision, model: MODEL, log: () => {} })
    expect(overlap).toBe(false)
  })

  it('logs when the page is taller than the screens sent', async () => {
    const logs: string[] = []
    const f = fake(() => ({ ok: true, costUsd: 0, text: '{"findings":[]}' }))
    await review(audited({ screenshot: png(2560, 2 * 800 * 7), pageHeight: 800 * 7 }), { source: null, vision: f.vision, model: MODEL, log: (s) => logs.push(s) })
    expect(f.asks[0]!.images).toHaveLength(4)
    expect(logs).toContain('Review covered the first 4 screens of 7')
  })

  it('counts findings it could not double-check, logs one line, and drops them', async () => {
    const logs: string[] = []
    const f = fake((n) => (n === 0 ? { ok: true, costUsd: 0, text: found } : { ok: false, error: 'HTTP 429: slow down' }))
    const out = await review(audited(), { source: null, vision: f.vision, model: MODEL, log: (s) => logs.push(s) })
    expect(out).toMatchObject({ findings: [], unchecked: 1, skipped: null })
    expect(logs).toEqual(['Review could not double-check 1 findings: HTTP 429: slow down'])
  })

  it('counts the rest as unchecked when the budget runs out mid-loop', async () => {
    const two = JSON.stringify({ findings: [0, 0, 0].map((element) => ({ rule: 'review/date-reads-wrong', element, message: 'm', confidence: 0.9 })) })
    const logs: string[] = []
    const f = fake((n) => (n === 0 ? { ok: true, costUsd: 0, text: two } : n === 1 ? { ok: true, costUsd: 0.01, text: '{"confirmed": true, "confidence": 0.9}' } : { ok: false, error: 'Monthly review budget spent' }))
    const out = await review(audited(), { source: null, vision: f.vision, model: MODEL, log: (s) => logs.push(s) })
    expect(out.findings).toHaveLength(1)
    expect(out.unchecked).toBe(2)
    expect(logs).toEqual(['Review could not double-check 2 findings: Monthly review budget spent'])
  })

  it('logs the truncation only after the first model call works', async () => {
    const logs: string[] = []
    const f = fake(() => ({ ok: false, error: 'No GEMINI_API_KEY' }))
    const out = await review(audited({ screenshot: png(2560, 2 * 800 * 7), pageHeight: 800 * 7 }), { source: null, vision: f.vision, model: MODEL, log: (s) => logs.push(s) })
    expect(out.skipped).toBe('No GEMINI_API_KEY')
    expect(logs).toEqual([])
  })

  it('does not log when everything fit', async () => {
    const logs: string[] = []
    const f = fake(() => ({ ok: true, costUsd: 0, text: '{"findings":[]}' }))
    await review(audited(), { source: null, vision: f.vision, model: MODEL, log: (s) => logs.push(s) })
    expect(logs).toEqual([])
  })
})
