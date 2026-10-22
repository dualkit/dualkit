import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { INJECTORS } from '../src/inject.js'
import { BEHAVIOURAL_OR_ENGINE_KINDS, basePages, buildCases, checkCaught, closeBrowser, lintCaught, markSelector, runCase, sharedLine } from '../src/misses.js'

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

describe('markSelector', () => {
  it('marks the first match as its first attribute and fails on no match', () => {
    const out = markSelector('<p><b class="x" id="y">a</b></p>', 'b.x')
    expect(out).toBe('<p><b data-eval-bug="real" class="x" id="y">a</b></p>')
    expect(() => markSelector('<p></p>', 'b')).toThrow(/No element/)
  })
})

describe('checkCaught', () => {
  const finding = (snippet: string, severity: 'warning' | 'note' = 'warning') => ({ rule: 'type/letter-spacing', title: '', severity, box: null, message: '', fix: '', snippet })
  const scored = (...findings: ReturnType<typeof finding>[]) => ({ ok: true as const, rulesPassed: 0, score: 0, missing: [], text: '', findings, screenshot: '', pageHeight: 0, unreadableStylesheets: 0 })
  const score = (pages: Record<string, ReturnType<typeof scored>>) => async (html: string) => pages[html]!

  it('counts a finding on the marked element as caught', async () => {
    const pages = { clean: scored(), bugged: scored(finding('<h1 data-eval-bug="arabic-tracking" style="letter-spacing: 0.08em;">')) }
    expect(await checkCaught('bugged', 'clean', score(pages))).toBe(true)
  })

  it('does not count a new finding on an unmarked sibling', async () => {
    const pages = { clean: scored(), bugged: scored(finding('<p style="letter-spacing: 0.08em;">')) }
    expect(await checkCaught('bugged', 'clean', score(pages))).toBe(false)
  })

  it('does not count a rule the clean page already reports on that element', async () => {
    const pages = { clean: scored(finding('<h1 style="x">')), bugged: scored(finding('<h1 data-eval-bug="k" style="x">')) }
    expect(await checkCaught('bugged', 'clean', score(pages))).toBe(false)
  })

  it('ignores notes', async () => {
    const pages = { clean: scored(), bugged: scored(finding('<h1 data-eval-bug="k">', 'note')) }
    expect(await checkCaught('bugged', 'clean', score(pages))).toBe(false)
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
  const digits = "<script>new Intl.NumberFormat('ar').format(5)</script>"

  it('counts a lint finding on the marked line as caught', () => {
    expect(lintCaught(page(digits.replace('<script>', '<script data-eval-bug="k">')), page('<script>1</script>'))).toBe(true)
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
