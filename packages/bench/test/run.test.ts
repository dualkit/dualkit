import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Browser } from 'playwright'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { BenchError, loadScreens, type ModelEntry } from '../src/config'
import { fakeGenerate } from '../src/fake'
import type { Generate } from '../src/providers'
import { currentMonth, runBench, SCORE_CONCURRENCY } from '../src/run'
import { makeStore } from '../src/store'

const model = (id: string): ModelEntry => ({ id, provider: 'openrouter', model: id, label: id, since: '2026-11', by: 'Fake', mark: 'google' })
const screens = loadScreens().slice(0, 1)
// A real phone-sized PNG at 2x, as the audit returns it, so the runner's WebP step runs for real.
const PNG = (await sharp({ create: { width: 780, height: 1600, channels: 3, background: '#ffffff' } }).png().toBuffer()).toString('base64')
const fastScore = async () => ({ ok: true as const, rulesPassed: 15, score: 40, missing: [], text: '', findings: [], screenshot: PNG, pageHeight: 800, unreadableStylesheets: 1 })

describe('runBench', () => {
  it('builds every model, screen, condition and run, then skips them on a rerun', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    const opts = { month: '2026-11', models: [model('fake-good')], screens, generate: fakeGenerate, store, score: fastScore }
    expect(await runBench(opts)).toEqual({ built: 6, skipped: 0, failed: 0, stoppedEarly: false })
    expect(await runBench(opts)).toEqual({ built: 0, skipped: 6, failed: 0, stoppedEarly: false })
  })
  it('builds only the first n runs when asked, for a live probe', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    expect(await runBench({ month: '2026-11', models: [model('fake-good')], screens, generate: fakeGenerate, store, score: fastScore, runs: 1 })).toMatchObject({ built: 2 })
    expect(store.list('2026-11').map((r) => `${r.condition}-${r.run}`)).toEqual(['alone-1', 'dualkit-1'])
  })
  it('records garbage replies as failed builds and redoes them next time', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    const out = await runBench({ month: '2026-11', models: [model('fake-garbage')], screens, generate: fakeGenerate, store, score: fastScore })
    expect(out.failed).toBe(6)
    expect(store.list('2026-11').every((r) => !r.ok && r.error === 'No HTML in the reply')).toBe(true)
  })
  it('stops calling a model after three auth failures, and carries on with the next', async () => {
    let calls = 0
    const deny: Generate = async (m) => (m.id === 'locked' ? (calls++, { ok: false, error: 'HTTP 401: no', ms: 1 }) : fakeGenerate(m, { system: '', prompt: '' }))
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    const out = await runBench({ month: '2026-11', models: [model('locked'), model('fake-good')], screens, generate: deny, store, score: fastScore })
    expect(calls).toBe(3)
    expect(out.built).toBe(6)
  })
  it('stops calling a model after three identical 400s', async () => {
    let calls = 0
    const bad: Generate = async () => (calls++, { ok: false, error: 'HTTP 400: model does not support system prompts', ms: 1 })
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    await runBench({ month: '2026-11', models: [model('bad')], screens, generate: bad, store, score: fastScore })
    expect(calls).toBe(3)
  })
  it('keeps calling a model whose 4xx errors differ, or that is rate limited', async () => {
    let calls = 0
    const varied: Generate = async () => (calls++, { ok: false, error: `HTTP 400: request ${calls}`, ms: 1 })
    await runBench({ month: '2026-11', models: [model('varied')], screens, generate: varied, store: makeStore(mkdtempSync(join(tmpdir(), 'run-'))), score: fastScore })
    expect(calls).toBe(6)
    let limited = 0
    const slow: Generate = async () => (limited++, { ok: false, error: 'HTTP 429: slow down', ms: 1 })
    await runBench({ month: '2026-11', models: [model('slow')], screens, generate: slow, store: makeStore(mkdtempSync(join(tmpdir(), 'run-'))), score: fastScore })
    expect(limited).toBe(6)
  })
  it('keeps going when scoring throws', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    const boom = async () => { throw new Error('chromium died') }
    const out = await runBench({ month: '2026-11', models: [model('fake-good')], screens, generate: fakeGenerate, store, score: boom })
    expect(out.failed).toBe(6)
  })
})

const tick = (ms = 2) => new Promise((r) => setTimeout(r, ms))

describe('concurrency', () => {
  it('runs models at once, while each model builds in model, screen, condition, run order', async () => {
    let inFlight = 0, most = 0
    const perModel = new Map<string, number>()
    let mostPerModel = 0
    const slow: Generate = async (m, r) => {
      inFlight++; most = Math.max(most, inFlight)
      perModel.set(m.id, (perModel.get(m.id) ?? 0) + 1); mostPerModel = Math.max(mostPerModel, perModel.get(m.id)!)
      await tick()
      inFlight--; perModel.set(m.id, perModel.get(m.id)! - 1)
      return fakeGenerate({ ...m, id: 'fake-good' }, r)
    }
    const lines: string[] = []
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    const two = loadScreens().slice(0, 2)
    const out = await runBench({ month: '2026-11', models: [model('a'), model('b'), model('c')], screens: two, generate: slow, store, score: fastScore, log: (l) => lines.push(l) })
    expect(out).toMatchObject({ built: 36, failed: 0 })
    expect(most).toBe(3)
    expect(mostPerModel).toBe(1)
    const expected = two.flatMap((s) => ['alone', 'dualkit'].flatMap((c) => [1, 2, 3].map((n) => `${s.id} ${c} ${n}`)))
    for (const id of ['a', 'b', 'c']) expect(lines.filter((l) => l.startsWith(`${id} `)).map((l) => l.split(':')[0]!.slice(id.length + 1))).toEqual(expected)
  })
  it(`scores at most ${SCORE_CONCURRENCY} builds at once`, async () => {
    expect(SCORE_CONCURRENCY).toBe(2)
    let inFlight = 0, most = 0
    const slowScore: typeof fastScore = async () => { inFlight++; most = Math.max(most, inFlight); await tick(5); inFlight--; return fastScore() }
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    await runBench({ month: '2026-11', models: ['a', 'b', 'c', 'd'].map(model), screens, generate: (m, r) => fakeGenerate({ ...m, id: 'fake-good' }, r), store, score: slowScore })
    expect(most).toBe(2)
  })
  it('relaunches the shared browser when it has died, before the next build', async () => {
    const launched: { alive: boolean }[] = []
    const launch = async () => {
      const b = { alive: true }
      launched.push(b)
      return { isConnected: () => b.alive, close: async () => { b.alive = false } } as unknown as Browser
    }
    const seen: unknown[] = []
    const killer = async (_h: string, _r: unknown, opts: { browser?: Browser } = {}) => {
      seen.push(opts.browser)
      if (seen.length === 1) launched[0]!.alive = false // Chromium crashes during the first build
      return fastScore()
    }
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    const out = await runBench({ month: '2026-11', models: [model('fake-good')], screens, generate: fakeGenerate, store, score: killer, launch })
    expect(out.built).toBe(6)
    expect(launched).toHaveLength(2)
    expect(new Set(seen.slice(1)).size).toBe(1)
    expect(seen[1]).not.toBe(seen[0])
  })
})

describe('soft deadline', () => {
  it('starts no build after the deadline, lets the one in flight finish, and says it stopped early', async () => {
    let clock = 0
    const timed: Generate = async (m, r) => { clock += 4; return fakeGenerate(m, r) } // builds start at 0, 4, 8, then 12 is past 10
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    const out = await runBench({ month: '2026-11', models: [model('fake-good')], screens, generate: timed, store, score: fastScore, deadline: 10, now: () => clock })
    expect(out).toEqual({ built: 3, skipped: 0, failed: 0, stoppedEarly: true })
    expect(store.list('2026-11')).toHaveLength(3)
    expect(clock).toBe(12) // the build that started at 8 ran past the deadline and was kept
  })
  it('does not say it stopped early when everything finished in time', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    const out = await runBench({ month: '2026-11', models: [model('fake-good')], screens, generate: fakeGenerate, store, score: fastScore, deadline: 10, now: () => 0 })
    expect(out.stoppedEarly).toBe(false)
  })
})

describe('skills check', () => {
  it('throws a BenchError before any API call when a skill has no SKILL.md', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'skills-'))
    mkdirSync(join(dir, 'broken'))
    let calls = 0
    const counting: Generate = async (m, r) => { calls++; return fakeGenerate(m, r) }
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    await expect(runBench({ month: '2026-11', models: [model('fake-good')], screens, generate: counting, store, score: fastScore, skillsDir: dir })).rejects.toBeInstanceOf(BenchError)
    expect(calls).toBe(0)
  })
})

describe('build records', () => {
  it('store the finish reason, reasoning tokens, served model and unreadable stylesheets of a scored build', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    await runBench({ month: '2026-11', models: [model('fake-good')], screens, generate: fakeGenerate, store, score: fastScore })
    expect(store.list('2026-11')[0]).toMatchObject({ ok: true, finish: 'stop', reasoningTokens: 0, servedModel: 'fake-good', unreadableStylesheets: 1 })
  })
  it('write one 1x WebP per scored build, from the scoring screenshot, and keep its page height', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    await runBench({ month: '2026-11', models: [model('fake-good')], screens, generate: fakeGenerate, store, score: fastScore })
    const rec = store.list('2026-11')[0]!
    expect(rec).toMatchObject({ ok: true, pageHeight: 800 })
    const meta = await sharp(readFileSync(store.paths(rec).webp)).metadata()
    expect(meta).toMatchObject({ format: 'webp', width: 390, height: 800 })
  })
  it('keep a reply cut off at the token cap as a failed build with its metadata', async () => {
    const capped: Generate = async () => ({ ok: false, error: 'Hit the token cap', ms: 9, reply: { text: '<html><body>half', usage: { input: 1, output: 12000 }, finish: 'length', reasoningTokens: 4000, servedModel: 'm-2026' } })
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    const out = await runBench({ month: '2026-11', models: [model('capped')], screens, generate: capped, store, score: fastScore })
    expect(out.failed).toBe(6)
    expect(store.list('2026-11')[0]).toMatchObject({ ok: false, error: 'Hit the token cap', reply: '<html><body>half', usage: { output: 12000 }, finish: 'length', reasoningTokens: 4000, servedModel: 'm-2026' })
  })
  it('leave the metadata null on a failure with no reply', async () => {
    const down: Generate = async () => ({ ok: false, error: 'HTTP 503: down', ms: 1 })
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    await runBench({ month: '2026-11', models: [model('down')], screens, generate: down, store, score: fastScore })
    expect(store.list('2026-11')[0]).toMatchObject({ ok: false, reply: null, usage: null, finish: null, reasoningTokens: null, servedModel: null })
  })
})

describe('currentMonth', () => {
  it('is the UTC month', () => {
    expect(currentMonth(new Date('2026-11-01T00:30:00+04:00'))).toBe('2026-10')
  })
})

describe('progress.json', () => {
  const two = loadScreens().slice(0, 2)
  const progress = (store: ReturnType<typeof makeStore>) => JSON.parse(readFileSync(store.progressFile('2026-11'), 'utf8'))
  it('ends with running false, done equal to total, and the newest build first', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    await runBench({ month: '2026-11', models: [model('fake-good')], screens: two, generate: fakeGenerate, store, score: fastScore, runs: 1 })
    const p = progress(store)
    expect(p).toMatchObject({ month: '2026-11', running: false, total: 4, done: 4 })
    expect(Number.isNaN(Date.parse(p.updatedAt))).toBe(false)
    expect(p.recent.map((r: { screen: string; condition: string }) => `${r.screen} ${r.condition}`)).toEqual([
      `${two[1]!.id} dualkit`, `${two[1]!.id} alone`, `${two[0]!.id} dualkit`, `${two[0]!.id} alone`,
    ])
    expect(p.recent[0]).toMatchObject({ model: 'fake-good', label: 'fake-good', by: 'Fake', mark: 'google', screenTitle: two[1]!.title, ok: true, rulesPassed: 15, error: null })
  })
  it('is written at the start and after every build, with running true until the end', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    const seen: { running: boolean; done: number }[] = []
    const peek: Generate = async (m, r) => { seen.push(progress(store)); return fakeGenerate(m, r) }
    await runBench({ month: '2026-11', models: [model('fake-good')], screens: two, generate: peek, store, score: fastScore, runs: 1 })
    expect(seen.map((s) => s.done)).toEqual([0, 1, 2, 3])
    expect(seen.every((s) => s.running)).toBe(true)
  })
  it('counts failed builds as done and records their clipped error', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    const down: Generate = async () => ({ ok: false, error: `HTTP 503: ${'z'.repeat(200)}`, ms: 1 })
    await runBench({ month: '2026-11', models: [model('down')], screens: two, generate: down, store, score: fastScore, runs: 1 })
    const p = progress(store)
    expect(p).toMatchObject({ running: false, total: 4, done: 4 })
    expect(p.recent[0]).toMatchObject({ ok: false, rulesPassed: null })
    expect(p.recent[0].error).toHaveLength(80)
  })
  it('counts builds skipped as done but leaves them out of recent', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    const opts = { month: '2026-11', models: [model('fake-good')], screens: two, generate: fakeGenerate, store, score: fastScore, runs: 1 }
    await runBench(opts)
    // One build left to redo: the rest are skipped, counted as done, and only the redone build is recent.
    rmSync(store.paths({ month: '2026-11', model: 'fake-good', screen: two[0]!.id, condition: 'alone', run: 1 }).json)
    await runBench(opts)
    const p = progress(store)
    expect(p).toMatchObject({ running: false, total: 4, done: 4 })
    expect(p.recent.map((r: { screen: string; condition: string }) => `${r.screen} ${r.condition}`)).toEqual([`${two[0]!.id} alone`])
  })
  it('writes no progress file at all when every build of the run is already done', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    const opts = { month: '2026-11', models: [model('fake-good')], screens: two, generate: fakeGenerate, store, score: fastScore, runs: 1 }
    await runBench(opts)
    const bytes = readFileSync(store.progressFile('2026-11'), 'utf8')
    await runBench(opts)
    expect(readFileSync(store.progressFile('2026-11'), 'utf8')).toBe(bytes)
    const fresh = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    for (const k of [two[0]!, two[1]!].flatMap((sc) => (['alone', 'dualkit'] as const).map((condition) => ({ month: '2026-11', model: 'fake-good', screen: sc.id, condition, run: 1 }))))
      fresh.write({ ...k, at: '2026-11-01T04:30:00.000Z', reply: 'r', usage: null, ms: 1, finish: 'stop', reasoningTokens: 0, servedModel: 'x', ok: true, rulesPassed: 1, score: 1, missing: [], findings: [], unreadableStylesheets: 0, pageHeight: 1 }, '<html></html>')
    await runBench({ ...opts, store: fresh })
    expect(existsSync(fresh.progressFile('2026-11'))).toBe(false)
  })
  it('is running false when it stops early at the deadline, with done short of total', async () => {
    let clock = 0
    const timed: Generate = async (m, r) => { clock += 4; return fakeGenerate(m, r) }
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    await runBench({ month: '2026-11', models: [model('fake-good')], screens, generate: timed, store, score: fastScore, deadline: 10, now: () => clock })
    expect(progress(store)).toMatchObject({ running: false, total: 6, done: 3 })
  })
  it('keeps one valid file when models finish builds at the same time', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    await runBench({ month: '2026-11', models: ['a', 'b', 'c'].map(model), screens: two, generate: (m, r) => fakeGenerate({ ...m, id: 'fake-good' }, r), store, score: fastScore, runs: 2 })
    expect(progress(store)).toMatchObject({ running: false, total: 24, done: 24 })
  })
})
