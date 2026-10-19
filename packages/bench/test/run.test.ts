import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Browser } from 'playwright'
import { describe, expect, it } from 'vitest'
import { BenchError, loadScreens, type ModelEntry } from '../src/config'
import { fakeGenerate } from '../src/fake'
import type { Generate } from '../src/providers'
import { currentMonth, runBench, SCORE_CONCURRENCY } from '../src/run'
import { makeStore } from '../src/store'

const model = (id: string): ModelEntry => ({ id, provider: 'openrouter', model: id, label: id, since: '2026-11' })
const screens = loadScreens().slice(0, 1)
const fastScore = async () => ({ ok: true as const, rulesPassed: 15, score: 40, missing: [], findings: [], screenshot: 'x', pageHeight: 800, unreadableStylesheets: 1 })

describe('runBench', () => {
  it('builds every model, screen, condition and run, then skips them on a rerun', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'run-')))
    const opts = { month: '2026-11', models: [model('fake-good')], screens, generate: fakeGenerate, store, score: fastScore }
    expect(await runBench(opts)).toEqual({ built: 6, skipped: 0, failed: 0 })
    expect(await runBench(opts)).toEqual({ built: 0, skipped: 6, failed: 0 })
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
