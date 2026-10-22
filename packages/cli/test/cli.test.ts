import { readFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import type { AuditResult } from '../src/audit'
import { parseReviewModel, run } from '../src/cli'

const fake = (score = 80): AuditResult => ({
  url: 'https://example.com/', date: '2026-10-16T00:00:00.000Z', width: 1280, height: 800, score, findings: [],
  screenshot: '', pageHeight: 800, unreadableStylesheets: 0, tags: {},
})

const io = (score = 80) => {
  const out: string[] = []
  const err: string[] = []
  const files: Record<string, string> = {}
  const calls: unknown[] = []
  return {
    out, err, files, calls,
    io: {
      out: (s: string) => out.push(s), err: (s: string) => err.push(s), write: (p: string, d: string) => { files[p] = d },
      audit: async (o: unknown) => { calls.push(o); return fake(score) }, cwd: process.cwd(),
    },
  }
}

describe('dualkit check', () => {
  it('audits, prints the summary and writes the report', async () => {
    const t = io()
    expect(await run(['check', 'https://example.com'], t.io)).toBe(0)
    expect(t.out.join('')).toContain('Score 80/100')
    expect(Object.keys(t.files)).toEqual(['dualkit-report.html'])
    expect(t.calls[0]).toMatchObject({ url: 'https://example.com/', width: 1280, height: 800 })
  })

  it('takes width, height and an output path', async () => {
    const t = io()
    await run(['check', 'https://example.com', '--width', '390', '--height', '844', '--out', 'r.html'], t.io)
    expect(t.calls[0]).toMatchObject({ width: 390, height: 844 })
    expect(Object.keys(t.files)).toEqual(['r.html'])
  })

  it('prints JSON with --json', async () => {
    const t = io()
    await run(['check', 'https://example.com', '--json'], t.io)
    expect(JSON.parse(t.out.join('')).score).toBe(80)
  })

  it('exits 1 below --min-score', async () => {
    expect(await run(['check', 'https://example.com', '--min-score', '90'], io(80).io)).toBe(1)
  })

  it('exits 2 with a clear message on bad input', async () => {
    for (const argv of [[], ['lint', 'x'], ['check'], ['check', 'not a page'], ['check', 'https://x.com', '--width', 'wide']]) {
      const t = io()
      expect(await run(argv, t.io), argv.join(' ')).toBe(2)
      expect(t.err.join('').length, argv.join(' ')).toBeGreaterThan(0)
    }
  })

  it.each([
    ['--width', '0'], ['--height', '0'], ['--width', ''], ['--height', ''], ['--min-score', ''], ['--min-score', 'high'], ['--min-score', '-1'],
  ])('rejects %s "%s" before running the audit', async (flag, value) => {
    const t = io()
    expect(await run(['check', 'https://example.com', flag, value], t.io)).toBe(2)
    expect(t.err.join('')).toContain(flag)
    expect(t.calls).toHaveLength(0)
  })

  it('sets the exit code instead of exiting, so piped JSON is never cut short', () => {
    const source = readFileSync(new URL('../src/cli.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/process\.exit\(/)
    expect(source).toMatch(/process\.exitCode = code/)
  })

  it('prints help', async () => {
    const t = io()
    expect(await run(['--help'], t.io)).toBe(0)
    expect(t.out.join('')).toContain('dualkit check <url or file>')
  })
})

const shot = PNG.sync.write(new PNG({ width: 2560, height: 1600 })).toString('base64')
const screen = {
  root: { lang: 'ar', dir: 'rtl', computedDir: 'rtl' }, texts: [{ id: 'p', snippet: '<p>مرحبا</p>', box: { x: 20, y: 30, width: 80, height: 20 }, text: '٢٠٢٦/١٠/٢٢', blockHasArabic: true }],
  layouts: [], icons: [], fields: [], fonts: [], labels: [], clips: [], joins: [], unreadableStylesheets: 0, viewportWidth: 1280,
}
const reviewable = (url = 'https://example.com/') => ({ ...fake(80), url, screenshot: shot, screen }) as unknown as AuditResult
const found = '{"findings":[{"rule":"review/date-reads-wrong","element":0,"message":"The year comes first.","confidence":0.9}]}'
const sure = async (_m: unknown, ask: { text: string }) => ({ ok: true as const, costUsd: 0.01, text: ask.text.includes('claimed problem') ? '{"confirmed": true, "confidence": 0.8}' : found })

describe('dualkit check --review', () => {
  const withReview = (vision: unknown, result: AuditResult = reviewable()) => {
    const t = io()
    return { ...t, io: { ...t.io, audit: async () => result, vision: vision as never } }
  }

  it('prints check findings, then review findings marked review', async () => {
    const t = withReview(sure)
    expect(await run(['check', 'https://example.com', '--review'], t.io)).toBe(0)
    const text = t.out.join('')
    expect(text).toContain('Score 80/100')
    expect(text.indexOf('Score 80/100')).toBeLessThan(text.indexOf('review review/date-reads-wrong'))
    expect(text).toContain('80% sure')
    expect(t.files['dualkit-report.html']).toContain('class="badge"')
  })

  it('with no key prints the check result, one stderr line, and the same exit code', async () => {
    const { makeVision } = await import('../src/review/model')
    const vision = makeVision({ env: {} })
    for (const score of [80, 40]) {
      const t = withReview(vision, { ...reviewable(), score })
      const plain = io(score)
      const withFlag = await run(['check', 'https://example.com', '--review', '--min-score', '50'], t.io)
      expect(withFlag).toBe(await run(['check', 'https://example.com', '--min-score', '50'], plain.io))
      expect(t.err.join('')).toBe('Review skipped: No GEMINI_API_KEY\n')
      expect(t.out.join('')).toContain(`Score ${score}/100`)
    }
  })

  it('adds review spend and skipped state to --json, without the model data', async () => {
    const t = withReview(sure)
    await run(['check', 'https://example.com', '--review', '--json'], t.io)
    const json = JSON.parse(t.out.join(''))
    expect(json.review).toMatchObject({ spentUsd: expect.closeTo(0.02), skipped: null })
    expect(json.review.findings[0]).toMatchObject({ source: 'review', line: null })
    expect(json.screen).toBeUndefined()
  })

  it('survives a vision that throws: same exit code, report still written', async () => {
    const t = withReview(async () => { throw new Error('boom') })
    const plain = io(80)
    expect(await run(['check', 'https://example.com', '--review', '--min-score', '90'], t.io)).toBe(await run(['check', 'https://example.com', '--min-score', '90'], plain.io))
    expect(t.err.join('')).toBe('Review skipped: Review failed: boom\n')
    expect(Object.keys(t.files)).toEqual(['dualkit-report.html'])
  })

  it('reports how many findings it could not double-check in --json', async () => {
    const t = withReview(async (_m: unknown, ask: { text: string }) => (ask.text.includes('claimed problem') ? { ok: false, error: 'HTTP 429' } : { ok: true, costUsd: 0, text: found }))
    await run(['check', 'https://example.com', '--review', '--json'], t.io)
    expect(JSON.parse(t.out.join('')).review).toMatchObject({ unchecked: 1, skipped: null, findings: [] })
    expect(t.err.join('')).toContain('Review could not double-check 1 finding: HTTP 429')
  })

  it('does not say found nothing when findings could not be double-checked', async () => {
    const t = withReview(async (_m: unknown, ask: { text: string }) => (ask.text.includes('claimed problem') ? { ok: false, error: 'HTTP 429' } : { ok: true, costUsd: 0, text: found }))
    await run(['check', 'https://example.com', '--review'], t.io)
    expect(t.out.join('')).not.toContain('Review found nothing')
    expect(t.out.join('')).toContain('Review could not double-check 1 finding')
  })

  it('says when review found nothing, and still shows spend', async () => {
    const t = withReview(async () => ({ ok: true, costUsd: 0.5, text: '{"findings":[]}' }))
    await run(['check', 'https://example.com', '--review'], t.io)
    expect(t.out.join('')).toContain('Review found nothing')
    expect(t.out.join('')).toContain('Review spent $0.5000')
  })

  it('does not change the score or the exit code', async () => {
    const t = withReview(sure)
    expect(await run(['check', 'https://example.com', '--review', '--min-score', '80'], t.io)).toBe(0)
    expect(t.out.join('')).toContain('Score 80/100')
  })

  it('does not call the model without --review', async () => {
    let calls = 0
    const t = withReview(async () => { calls++; return { ok: false, error: 'x' } })
    await run(['check', 'https://example.com'], t.io)
    expect(calls).toBe(0)
    expect(t.out.join('')).not.toContain('review')
  })

  it('points a local file finding at its line', async () => {
    const url = new URL('./fixtures/page.html', import.meta.url).href
    const t = withReview(sure, { ...reviewable(url), screen: { ...screen, texts: [{ ...screen.texts[0]!, snippet: '<h1>' }] } as never })
    await run(['check', url, '--review', '--json'], t.io)
    expect(JSON.parse(t.out.join('')).review.findings[0].line).toBe(5)
  })

  it.each(['gemini', 'nope:model', ':model', 'gemini:'])('rejects --review-model "%s" as a usage error before the audit', async (value) => {
    const t = withReview(sure)
    let audited = false
    t.io.audit = async () => { audited = true; return reviewable() }
    expect(await run(['check', 'https://example.com', '--review', '--review-model', value], t.io)).toBe(2)
    expect(t.err.join('')).toContain('--review-model')
    expect(audited).toBe(false)
  })

  it('needs --review for --review-model, and lint takes neither', async () => {
    expect(await run(['check', 'https://example.com', '--review-model', 'gemini:x'], io().io)).toBe(2)
    expect(await run(['lint', '.', '--review'], io().io)).toBe(2)
  })
})

describe('parseReviewModel', () => {
  it('defaults to Gemini and splits at the first colon', () => {
    expect(parseReviewModel(undefined)).toEqual({ provider: 'gemini', model: 'gemini-flash-lite-latest' })
    expect(parseReviewModel('openrouter:google/gemma-3-27b-it:free')).toEqual({ provider: 'openrouter', model: 'google/gemma-3-27b-it:free' })
  })
})
