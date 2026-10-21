import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadScreens, type ModelEntry } from '../src/config'
import { harm, loopBuild, MAX_ROUNDS } from '../src/loop'
import type { Generate, Generated, Turn } from '../src/providers'
import type { Scored, SlimFinding } from '../src/score'
import { makeStore, type BuildKey, type BuildRecord } from '../src/store'

const model: ModelEntry = { id: 'm', provider: 'openrouter', model: 'm', label: 'M', since: '2026-11', by: 'Fake', mark: 'google' }
const screen = loadScreens()[0]!
const dk: BuildKey = { month: '2026-11', model: 'm', screen: screen.id, condition: 'dualkit', run: 1 }
const key: BuildKey = { ...dk, condition: 'loop' }

/** A page the stub scorer reads back: which rules fail, which parts are missing, and its text. */
const page = (fail: string[], text = 'مرحبا بكم', missing: string[] = []) =>
  `<!doctype html><html lang="ar" dir="rtl"><body data-fail="${fail.join(',')}" data-missing="${missing.join(',')}"><p>${text}</p></body></html>`
const fenced = (html: string) => '```html\n' + html + '\n```'
const finding = (rule: string): SlimFinding => ({ rule, title: rule, severity: 'warning', box: null, message: 'm', fix: 'f', snippet: null })
const list = (html: string, attr: string) => (html.match(new RegExp(`data-${attr}="([^"]*)"`))?.[1] ?? '').split(',').filter(Boolean)
const scorer = async (html: string): Promise<Scored> => {
  if (html.includes('BROKEN')) return { ok: false, error: 'boom' }
  const fail = list(html, 'fail')
  return { ok: true, rulesPassed: 20 - fail.length, score: 100 - 10 * fail.length, missing: list(html, 'missing'), text: html.match(/<p>(.*)<\/p>/)?.[1] ?? '', findings: fail.map(finding), screenshot: 'png', pageHeight: 900, unreadableStylesheets: 0 }
}
const reply = (text: string): Generated => ({ ok: true, text, usage: { input: 10, output: 20 }, finish: 'stop', reasoningTokens: 0, servedModel: 'm', ms: 5 })

function setup(dualkitHtml: string | null, ok = true) {
  const store = makeStore(mkdtempSync(join(tmpdir(), 'loop-')))
  const fail = dualkitHtml ? list(dualkitHtml, 'fail') : []
  const rec: BuildRecord = ok
    ? { ...dk, at: '2026-11-01T04:20:00Z', reply: fenced(dualkitHtml ?? ''), usage: null, ms: 1, finish: 'stop', reasoningTokens: 0, servedModel: 'm', ok: true, rulesPassed: 20 - fail.length, score: 100 - 10 * fail.length, missing: [], findings: fail.map(finding), unreadableStylesheets: 0, pageHeight: 900 }
    : { ...dk, at: '2026-11-01T04:20:00Z', reply: null, usage: null, ms: 1, finish: null, reasoningTokens: null, servedModel: null, ok: false, error: 'HTTP 503' }
  store.write(rec, dualkitHtml, Buffer.from('dualkit webp'))
  return store
}
function stub(replies: Generated[]) {
  const calls: Turn[][] = []
  const generate: Generate = async (_m, req) => { calls.push(req.turns ?? []); return replies[calls.length - 1] ?? reply('no more') }
  return { generate, calls }
}
const run = (store: ReturnType<typeof makeStore>, generate: Generate) =>
  loopBuild({ key, model, screen, generate, store, scorer: (h) => scorer(h), shoot: async (png) => Buffer.from(`webp of ${png}`) })

const down = (error: string): Generated => ({ ok: false, error, ms: 3 })

describe('harm', () => {
  it('lists rules failed after and not before, and parts lost', () => {
    const out = harm({ failed: ['a', 'b'], missing: ['x'], text: '' }, { failed: ['b', 'c'], missing: ['x', 'y'], text: '' })
    expect(out).toEqual({ regressed: ['c'], lostParts: ['y'], arabicKept: 1 })
  })
  it('keeps 0.5 of the Arabic when half the letters go', () => {
    expect(harm({ failed: [], missing: [], text: 'ابتث 12' }, { failed: [], missing: [], text: 'اب hi' }).arabicKept).toBe(0.5)
    expect(harm({ failed: [], missing: [], text: 'اا' }, { failed: [], missing: [], text: 'ا' }).arabicKept).toBe(0.5)
  })
  it('counts lint rules failed after and not before', async () => {
    const store = setup(page(['a']))
    const spaced = page([]).replace('<p>', '<style>:lang(ar) p { letter-spacing: 2px }</style><p>')
    const { generate } = stub([reply(fenced(spaced))])
    const out = (await run(store, generate))!
    const rounds = out.record.ok ? out.record.rounds! : []
    expect(rounds[0]).toMatchObject({ ok: true, regressed: ['source/arabic-letter-spacing'] })
  })
  it('is 1 when there was no Arabic before', () => {
    expect(harm({ failed: [], missing: [], text: 'hello' }, { failed: [], missing: [], text: '' }).arabicKept).toBe(1)
  })
})

describe('loopBuild', () => {
  it('records a reply with no HTML as a failed round and keeps the dualkit page', async () => {
    const before = page(['a'])
    const store = setup(before)
    const { generate, calls } = stub([reply('Sorry.'), reply('Still no.')])
    const out = (await run(store, generate))!
    expect(out.record).toMatchObject({ condition: 'loop', ok: true, rulesPassed: 19, score: 90, from: { rulesPassed: 19, score: 90 } })
    expect(out.html).toBe(before)
    expect(out.shot?.toString()).toBe('dualkit webp')
    const rounds = out.record.ok ? out.record.rounds! : []
    expect(rounds.map((r) => [r.ok, r.error])).toEqual([[false, 'No HTML in the reply'], [false, 'No HTML in the reply']])
    // The failed exchange is dropped: round 2 asks again from the dualkit page.
    expect(calls[1]).toEqual(calls[0])
  })
  it('records a page that fails to render as a failed round', async () => {
    const store = setup(page(['a']))
    const { generate } = stub([reply(fenced(page(['a'], 'BROKEN'))), reply(fenced(page([])))])
    const out = (await run(store, generate))!
    const rounds = out.record.ok ? out.record.rounds! : []
    expect(rounds[0]).toMatchObject({ ok: false, error: 'Render failed: boom', rulesPassed: null, score: null, arabicKept: null })
    expect(rounds[1]).toMatchObject({ ok: true, rulesPassed: 20 })
    expect(out.record).toMatchObject({ rulesPassed: 20, score: 100 })
  })
  it('fails the build, keeping the usage spent, on a provider error that may clear', async () => {
    for (const error of ['HTTP 503: down', 'HTTP 429: slow', 'Network error: reset', 'Timed out after 600 s', 'HTTP 401: no', 'Daily request budget spent']) {
      const store = setup(page(['a', 'b']))
      const { generate } = stub([reply(fenced(page(['b']))), down(error)])
      const out = (await run(store, generate))!
      expect(out.record).toMatchObject({ ok: false, error, usage: { input: 10, output: 20 }, ms: 5 })
      expect(out.html).toBeNull()
    }
  })
  it('records a provider error that will not clear as a failed round and keeps the last good page', async () => {
    const store = setup(page(['a', 'b']))
    const better = page(['b'])
    const { generate } = stub([reply(fenced(better)), down('HTTP 400: context too long')])
    const out = (await run(store, generate))!
    expect(out.html).toBe(better)
    expect(out.record).toMatchObject({ ok: true, rulesPassed: 19 })
    const rounds = out.record.ok ? out.record.rounds! : []
    expect(rounds[1]).toMatchObject({ ok: false, error: 'HTTP 400: context too long', reply: null, usage: null, rulesPassed: null })
  })
  it('fails the build without a call when the dualkit page will not render again', async () => {
    const store = setup(page(['a'], 'BROKEN'))
    const { generate, calls } = stub([])
    const out = (await run(store, generate))!
    expect(calls).toHaveLength(0)
    expect(out.record).toMatchObject({ ok: false, error: 'Render failed: boom', usage: null })
  })
  it('does not try and writes nothing when the dualkit build failed or its page is missing', async () => {
    const failed = setup(null, false)
    const a = stub([])
    expect(await run(failed, a.generate)).toBeNull()
    const gone = setup(page(['a']))
    rmSync(gone.paths(dk).html)
    const b = stub([])
    expect(await run(gone, b.generate)).toBeNull()
    expect(a.calls.length + b.calls.length).toBe(0)
    expect(failed.read(key)).toBeNull()
  })
  it('records lost parts when a fix deletes content, and the page is incomplete', async () => {
    const store = setup(page(['a'], 'مرحبا بكم'))
    const { generate } = stub([reply(fenced(page([], 'مرحبا', ['amount'])))])
    const out = (await run(store, generate))!
    const rounds = out.record.ok ? out.record.rounds! : []
    expect(rounds).toHaveLength(1)
    expect(rounds[0]).toMatchObject({ ok: true, regressed: [], lostParts: ['amount'], missing: ['amount'], arabicKept: 0.625 })
    expect(out.record).toMatchObject({ missing: ['amount'] })
  })
  it('writes zero rounds and the same score without a call when nothing is at warning or error', async () => {
    const store = setup(page([]))
    const { generate, calls } = stub([])
    const out = (await run(store, generate))!
    expect(calls).toHaveLength(0)
    expect(out.record).toMatchObject({ ok: true, rulesPassed: 20, score: 100, rounds: [], from: { rulesPassed: 20, score: 100 } })
  })
  it('stops after two rounds', async () => {
    const store = setup(page(['a', 'b']))
    const { generate, calls } = stub([reply(fenced(page(['b']))), reply(fenced(page(['b']))), reply(fenced(page([])))])
    const out = (await run(store, generate))!
    expect(MAX_ROUNDS).toBe(2)
    expect(calls).toHaveLength(2)
    expect(out.record).toMatchObject({ rulesPassed: 19 })
  })
  it('sends the dualkit reply and the feedback as turns', async () => {
    const before = page(['a', 'b'])
    const store = setup(before)
    const r1 = fenced(page(['b']))
    const { generate, calls } = stub([reply(r1), reply(fenced(page([])))])
    const out = (await run(store, generate))!
    expect(calls[0]).toHaveLength(2)
    expect(calls[0]![0]).toEqual({ role: 'assistant', content: fenced(before) })
    expect(calls[0]![1]!.role).toBe('user')
    expect(calls[0]![1]!.content).toMatch(/^dualkit check and dualkit lint found these problems/)
    expect(calls[0]![1]!.content).toContain('[check] a (a)')
    expect(calls[1]).toHaveLength(4)
    expect(calls[1]!.slice(0, 2)).toEqual(calls[0])
    expect(calls[1]![2]).toEqual({ role: 'assistant', content: r1 })
    expect(calls[1]![3]!.content).not.toContain('[check] a (a)')
    expect(calls[1]![3]!.content).toContain('[check] b (b)')
    const rounds = out.record.ok ? out.record.rounds! : []
    expect(rounds.map((r) => r.sent)).toEqual([2, 1])
  })
  it('keeps the last good page when round 2 fails', async () => {
    const store = setup(page(['a', 'b']))
    const better = page(['b'])
    const { generate } = stub([reply(fenced(better)), reply('nope')])
    const out = (await run(store, generate))!
    expect(out.html).toBe(better)
    expect(out.shot?.toString()).toBe('webp of png')
    expect(out.record).toMatchObject({ ok: true, rulesPassed: 19, score: 90, reply: fenced(better), from: { rulesPassed: 18, score: 80 } })
    const rounds = out.record.ok ? out.record.rounds! : []
    expect(rounds.map((r) => r.ok)).toEqual([true, false])
  })
})
