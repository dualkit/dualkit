import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { INJECTORS } from '../src/inject.js'
import { BEHAVIOURAL_OR_ENGINE_KINDS, EMPTY_PAGE, basePages, buildCases, loadFrozenCases, roundRobin, checkCaught, closeBrowser, lintCaught, markSelector, runCase, sharedBrowser, sharedLine } from '../src/misses.js'
import type { Browser } from 'playwright'

const fixture = (name: string) => new URL(`./fixtures/pages/${name}.html`, import.meta.url).pathname
const KINDS = INJECTORS.map((i) => i.kind)
const temp = mkdtempSync(join(tmpdir(), 'eval-misses-'))
afterAll(async () => {
  rmSync(temp, { recursive: true, force: true })
  await closeBrowser()
})

function record(dir: string, name: string, stored: object): void {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${name}.html`), '<html></html>')
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(stored))
}

const note = { rule: 'a', severity: 'note' }
const warning = { rule: 'a', severity: 'warning' }
const ok = { ok: true, missing: [], findings: [note] }

describe('basePages', () => {
  it('takes only clean, complete pages', () => {
    const runs = join(temp, 'runs')
    record(join(runs, 'm', 's'), 'a-clean', ok)
    record(join(runs, 'm', 's'), 'b-warning', { ...ok, findings: [warning] })
    record(join(runs, 'm', 's'), 'c-missing', { ...ok, missing: ['x'] })
    record(join(runs, 'm', 's'), 'd-failed', { ok: false })
    writeFileSync(join(runs, 'm', 's', 'e-no-record.html'), '<html></html>')
    expect(basePages(runs)).toEqual([join(runs, 'm', 's', 'a-clean.html')])
  })
})

describe('roundRobin', () => {
  it('takes pages one model at a time, sorted within each model', () => {
    const runs = join(temp, 'rr')
    const at = (m: string, n: string) => join(runs, m, 's', `${n}.html`)
    const out = roundRobin(runs, [at('b', '2'), at('a', '2'), at('a', '1'), at('b', '1'), at('a', '3')])
    expect(out).toEqual([at('a', '1'), at('b', '1'), at('a', '2'), at('b', '2'), at('a', '3')])
  })
})

describe('real-world misses', () => {
  it('compare against an empty page, not the earlier draft', async () => {
    const seen: string[] = []
    const score = async (html: string) => { seen.push(html); return { ok: true as const, findings: [], screenshot: '' } as never }
    await runCase({ id: 'real:x', kind: 'real', base: 'x', html: '<p data-eval-bug="k">x</p>' }, 'DRAFT PAGE', { score })
    expect(seen).toContain(EMPTY_PAGE)
    expect(seen).not.toContain('DRAFT PAGE')
  })
})

describe('buildCases', () => {
  const pages = ['arabic-tracking', 'back-arrow'].map((name) => {
    const path = join(temp, `${name}.html`)
    copyFileSync(fixture(name), path)
    return path
  })

  it('builds at most one case per kind per page and reports short kinds', async () => {
    const { cases, dropped } = await buildCases(pages, 3, { render: async (html) => html, real: [] })
    for (const kind of KINDS) {
      expect(cases.filter((c) => c.kind === kind).length).toBeLessThanOrEqual(2)
      expect(dropped.find((d) => d.id === kind)?.why).toMatch(/fewer than 3/)
    }
    expect(cases.map((c) => c.kind)).toContain('arabic-tracking')
    expect(cases.map((c) => c.kind)).toContain('back-arrow')
    expect(cases.every((c) => c.html.includes('data-eval-bug'))).toBe(true)
  })

  it('drops a case that renders the same as its clean page, but not the behavioural or engine kinds', async () => {
    const { cases, dropped } = await buildCases(pages, 1, { render: async () => 'same', real: [] })
    expect(cases.map((c) => c.kind)).toEqual(['arabic-tracking'])
    const same = dropped.filter((d) => d.why === 'renders the same as the clean page').map((d) => d.id.split(':')[0])
    expect(same).toContain('back-arrow')
    expect(same).not.toContain('arabic-tracking')
    const otp = join(temp, 'otp.html')
    copyFileSync(fixture('otp-digits'), otp)
    const kept = await buildCases([otp], 1, { render: async () => 'same', real: [] })
    expect(kept.cases.map((c) => c.kind)).toContain('otp-digits')
    expect([...BEHAVIOURAL_OR_ENGINE_KINDS].sort()).toEqual(['arabic-tracking', 'otp-digits'])
  })

  it('keeps taking pages until a kind has enough surviving cases', async () => {
    const copies = [1, 2, 3].map((n) => {
      const path = join(temp, `track-${n}.html`)
      writeFileSync(path, `${readFileSync(fixture('back-arrow'), 'utf8')}<!--${n === 1 ? 'first' : 'later'}-->`)
      return path
    })
    // The first page renders the same after injection, the others differ.
    const render = async (html: string) => (html.includes('data-eval-bug') && !html.includes('<!--first-->') ? html : 'clean')
    const { cases, dropped } = await buildCases(copies, 2, { render, real: [] })
    expect(cases.filter((c) => c.kind === 'back-arrow').map((c) => c.base.split('/').pop())).toEqual(['track-2.html', 'track-3.html'])
    expect(dropped.some((d) => d.id.startsWith('back-arrow:') && /same/.test(d.why))).toBe(true)
  })

  it('adds the marker to a real miss by selector', async () => {
    const real = [{ id: 'r', base: 'x.html', bugged: 'packages/eval/test/fixtures/pages/back-arrow.html', selector: 'h1, button, a' }]
    const { cases } = await buildCases([], 1, { render: async (h) => h, real })
    expect(cases).toHaveLength(1)
    expect(cases[0]).toMatchObject({ id: 'real:r', kind: 'real', base: 'x.html' })
    expect(cases[0]!.html).toMatch(/<[a-z0-9]+ data-eval-bug="real"/)
  })
})

describe('frozen cases', () => {
  const FROZEN = new URL('../cases/miss-set-2026-10.json', import.meta.url).pathname

  it('loads the committed list: 64 planted cases, plus the one real miss makes 65', () => {
    const cases = loadFrozenCases(FROZEN)
    expect(cases).toHaveLength(64)
    expect(cases.every((c) => KINDS.includes(c.kind) && c.page.startsWith('bench/runs/2026-10/'))).toBe(true)
  })

  it('builds exactly the frozen pages in order and never looks for pages itself', async () => {
    const a = join(temp, 'frozen-a.html')
    const b = join(temp, 'frozen-b.html')
    copyFileSync(fixture('back-arrow'), a)
    copyFileSync(fixture('arabic-tracking'), b)
    const frozen = [{ kind: 'arabic-tracking' as const, page: b }, { kind: 'back-arrow' as const, page: a }]
    const render = async () => { throw new Error('render must not run') }
    const { cases, dropped } = await buildCases([], 8, { frozen, render, real: [] })
    expect(cases.map((c) => c.kind)).toEqual(['arabic-tracking', 'back-arrow'])
    expect(cases.map((c) => c.base.split('/').pop())).toEqual(['frozen-b.html', 'frozen-a.html'])
    expect(dropped).toEqual([])
  })

  it('throws a message naming a frozen page that no longer exists', async () => {
    const frozen = [{ kind: 'back-arrow' as const, page: join(temp, 'gone.html') }]
    await expect(buildCases([], 8, { frozen, real: [] })).rejects.toThrow(/gone\.html/)
  })
})

describe('markSelector', () => {
  it('marks the first match as its first attribute and fails on no match', () => {
    const out = markSelector('<p><b class="x" id="y">a</b></p>', 'b.x')
    expect(out).toBe('<p><b data-eval-bug="real" class="x" id="y">a</b></p>')
    expect(() => markSelector('<p></p>', 'b')).toThrow(/No element/)
  })
})

describe('checkCaught', () => {
  type Box = { x: number; y: number; width: number; height: number }
  const finding = (snippet: string, severity: 'warning' | 'note' = 'warning', box: Box | null = null) => ({ rule: 'type/letter-spacing', title: '', severity, box, message: '', fix: '', snippet })
  const scored = (...findings: ReturnType<typeof finding>[]) => ({ ok: true as const, rulesPassed: 0, score: 0, missing: [], text: '', findings, screenshot: '', pageHeight: 0, unreadableStylesheets: 0 })
  const run = (clean: ReturnType<typeof scored>, bugged: ReturnType<typeof scored>, marked: Box | null = null) =>
    checkCaught('bugged', 'clean', { score: async (html) => (html === 'bugged' ? bugged : clean), box: async () => marked })
  const MARKED: Box = { x: 10, y: 100, width: 300, height: 80 }

  it('counts a finding on the marked element as caught', async () => {
    expect(await run(scored(), scored(finding('<h1 data-eval-bug="arabic-tracking" style="letter-spacing: 0.08em;">')))).toBe(true)
  })

  it('does not count a new finding on an unmarked sibling', async () => {
    expect(await run(scored(), scored(finding('<p style="letter-spacing: 0.08em;">', 'warning', { x: 10, y: 400, width: 300, height: 20 })), MARKED)).toBe(false)
  })

  it('does not count a rule the clean page already reports on that element', async () => {
    expect(await run(scored(finding('<h1 style="x">')), scored(finding('<h1 data-eval-bug="k" style="x">')))).toBe(false)
  })

  it('does not count a long element whose finding the clean page already has', async () => {
    const tail = `class="${'a '.repeat(80)}">`
    const clean = finding(`<div ${tail}`.slice(0, 160))
    const bugged = finding(`<div data-eval-bug="k" ${tail}`.slice(0, 160))
    expect(await run(scored(clean), scored(bugged))).toBe(false)
  })

  it('does not count an ancestor whose snippet contains the marked child', async () => {
    const ancestor = finding('<div class="card"><h1 data-eval-bug="k" style="letter-spacing: 0.08em;">', 'warning', { x: 0, y: 0, width: 390, height: 844 })
    expect(await run(scored(), scored(ancestor), MARKED)).toBe(false)
  })

  it('counts a new finding on a descendant inside the marked box', async () => {
    const inner = finding('<span style="letter-spacing: 0.08em;">', 'warning', { x: 20, y: 110, width: 100, height: 20 })
    expect(await run(scored(), scored(inner), MARKED)).toBe(true)
  })

  it('ignores notes', async () => {
    expect(await run(scored(), scored(finding('<h1 data-eval-bug="k">', 'note')))).toBe(false)
  })

  it('sees letter-spacing on a marked Arabic heading in a real render', async () => {
    const clean = readFileSync(fixture('arabic-tracking'), 'utf8')
    const bugged = INJECTORS.find((i) => i.kind === 'arabic-tracking')!.inject(clean)!
    const results = await runCase({ id: 'x', kind: 'arabic-tracking', base: 'x', html: bugged }, clean)
    expect(results.map((r) => r.tool)).toEqual(['check', 'lint'])
    expect(results[0]!.caught).toBe(true)
  })
})

describe('lintCaught', () => {
  const page = (line: string) => `<!doctype html>
<html lang="ar" dir="rtl"><body>
<p>مرحبا</p>
${line}
</body></html>`
  const digits = "<script>new Intl.DateTimeFormat('ar', { calendar: 'islamic' }).format(5)</script>"

  it('counts a lint finding on the marked line as caught', () => {
    expect(lintCaught(page(digits.replace('<script>', '<script data-eval-bug="k">')), page('<script>1</script>'))).toBe(true)
  })

  it('reads lint lines as 1-based', () => {
    const digits = "<script>new Intl.DateTimeFormat('ar', { calendar: 'islamic' }).format(5)</script>"
    const second = `<p>x</p>\n${digits.replace('<script>', '<script data-eval-bug="k">')}`
    const first = `${digits.replace('<script>', '<script data-eval-bug="k">')}\n<p>x</p>`
    expect(lintCaught(second, '<p>x</p>\n<script>1</script>')).toBe(true)
    expect(lintCaught(first, '<script>1</script>\n<p>x</p>')).toBe(true)
    expect(lintCaught(`<p data-eval-bug="k">x</p>\n${digits}`, '<p>x</p>\n<script>1</script>')).toBe(false)
  })

  it('does not count a finding on another line', () => {
    const bugged = page(digits).replace('<p>', '<p data-eval-bug="k">')
    expect(lintCaught(bugged, page('<script>1</script>'))).toBe(false)
  })

  it('does not count a finding the clean page already has on that line', () => {
    expect(lintCaught(page(digits.replace('<script>', '<script data-eval-bug="k">')), page(digits))).toBe(false)
  })
})

describe('sharedLine', () => {
  it('flags a marked element that shares its line with other markup', () => {
    expect(sharedLine('<div>\n<p data-eval-bug="k">a</p>\n</div>')).toBe(false)
    expect(sharedLine('<div><p data-eval-bug="k">a</p></div>')).toBe(true)
  })
})

describe('sharedBrowser', () => {
  it('launches once when two callers ask at the same time, and closeBrowser closes that one browser', async () => {
    await closeBrowser()
    let launches = 0
    let closes = 0
    const launch = async (): Promise<Browser> => {
      launches += 1
      await new Promise((r) => setTimeout(r, 10))
      return { close: async () => { closes += 1 } } as unknown as Browser
    }
    const [a, b] = await Promise.all([sharedBrowser(launch), sharedBrowser(launch)])
    expect(a).toBe(b)
    expect(launches).toBe(1)
    await closeBrowser()
    expect(closes).toBe(1)
  })
  it('does not keep a failed launch', async () => {
    await closeBrowser()
    await expect(sharedBrowser(async () => { throw new Error('no browser') })).rejects.toThrow('no browser')
    let launches = 0
    await sharedBrowser(async () => { launches += 1; return { close: async () => {} } as unknown as Browser })
    expect(launches).toBe(1)
    await closeBrowser()
  })
})
