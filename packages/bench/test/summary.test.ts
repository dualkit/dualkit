import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { parseBenchMonth } from '../../../apps/site/lib/bench-schema'
import { loadScreens, type ModelEntry } from '../src/config'
import { makeStore, type BuildKey, type Condition } from '../src/store'
import { buildSummary, writeSummary } from '../src/summary'

const screens = loadScreens()
const model = (id: string, since = '2026-10'): ModelEntry => ({ id, provider: 'openrouter', model: id, label: id.toUpperCase(), since })

function seed(store: ReturnType<typeof makeStore>, id: string, passed: Record<Condition, number>, skip: string[] = []) {
  for (const s of screens) for (const condition of ['alone', 'dualkit'] as const) for (const run of [1, 2, 3]) {
    if (skip.includes(`${s.id}/${condition}`)) continue
    const k: BuildKey = { month: '2026-11', model: id, screen: s.id, condition, run }
    store.write({ ...k, at: '2026-11-01T04:30:00.000Z', reply: 'r', usage: null, ms: 1, finish: 'stop', reasoningTokens: 0, servedModel: id, ok: true, rulesPassed: passed[condition], score: passed[condition] * 4, missing: [], findings: [], unreadableStylesheets: 0, pageHeight: 900 }, '<html></html>', Buffer.from(`${id}/${s.id}/${condition}-${run}`))
  }
}

describe('default shots', () => {
  it('copies the median build\'s own WebP into the site, with no re-render', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'sum-')))
    const site = mkdtempSync(join(tmpdir(), 'site-'))
    seed(store, 'a', { alone: 8, dualkit: 18 })
    const out = await buildSummary({ month: '2026-11', models: [model('a')], screens, store, siteRoot: site })
    const c = out.models[0]!.screens[0]!.alone
    expect(c).toMatchObject({ ran: true, shot: '/bench/2026-11/a/payment-summary-alone.webp', pageHeight: 900 })
    // The seeded bytes are not an image, so only a straight copy of the median build (run 2) can produce them.
    expect(readFileSync(join(site, 'public', 'bench', '2026-11', 'a', 'payment-summary-alone.webp'), 'utf8')).toBe('a/payment-summary/alone-2')
  })
  it('leaves the shot null and warns when the build has no WebP', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'sum-')))
    const site = mkdtempSync(join(tmpdir(), 'site-'))
    seed(store, 'a', { alone: 8, dualkit: 18 })
    const rec = store.read({ month: '2026-11', model: 'a', screen: 'otp', condition: 'dualkit', run: 2 })!
    rmSync(store.paths(rec).webp)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const out = await buildSummary({ month: '2026-11', models: [model('a')], screens, store, siteRoot: site })
    expect(out.models[0]!.screens.find((x) => x.id === 'otp')!.dualkit).toMatchObject({ ran: true, shot: null, pageHeight: 900 })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('a/otp/dualkit'))
    warn.mockRestore()
  })
})

describe('reasons', () => {
  it('gives a cell that did not run the distinct errors of its failed builds, at most 3, clipped to 120 characters', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'sum-')))
    const fail = (screen: string, run: number, error: string) =>
      store.write({ month: '2026-11', model: 'a', screen, condition: 'alone', run, at: '2026-11-01T04:30:00.000Z', reply: null, usage: null, ms: 1, finish: null, reasoningTokens: null, servedModel: null, ok: false, error }, null)
    fail('otp', 1, 'Hit the token cap')
    fail('otp', 2, 'Hit the token cap')
    fail('otp', 3, `HTTP 400: ${'z'.repeat(300)}`)
    for (const [run, error] of ['one', 'two', 'three', 'four'].entries()) fail('profile', run + 1, error)
    const out = await buildSummary({ month: '2026-11', models: [model('a')], screens, store, shots: async () => null })
    const row = (id: string) => out.models[0]!.screens.find((s) => s.id === id)!.alone
    expect(row('otp')).toEqual({ ran: false, runs: 0, reasons: ['Hit the token cap', `HTTP 400: ${'z'.repeat(110)}`] })
    expect(row('profile')).toEqual({ ran: false, runs: 0, reasons: ['one', 'two', 'three'] })
    expect(parseBenchMonth(JSON.parse(JSON.stringify(out)))).toEqual(out)
  })
})

describe('generatedAt', () => {
  it('is the newest build time of the month, so a rerun with nothing new writes the same bytes', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'sum-')))
    seed(store, 'a', { alone: 8, dualkit: 18 })
    const k: BuildKey = { month: '2026-11', model: 'a', screen: 'otp', condition: 'alone', run: 1 }
    store.write({ ...store.read(k)!, at: '2026-11-02T09:15:00.000Z' }, '<html></html>', Buffer.from('x'))
    const site = mkdtempSync(join(tmpdir(), 'site-'))
    const first = await buildSummary({ month: '2026-11', models: [model('a')], screens, store, siteRoot: site })
    expect(first.generatedAt).toBe('2026-11-02T09:15:00.000Z')
    const file = writeSummary(first, site)
    const bytes = readFileSync(file, 'utf8')
    writeSummary(await buildSummary({ month: '2026-11', models: [model('a')], screens, store, siteRoot: site }), site)
    expect(readFileSync(file, 'utf8')).toBe(bytes)
  })
  it('is the first day of the month when nothing ran', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'sum-')))
    const out = await buildSummary({ month: '2026-11', models: [model('gone')], screens, store, shots: async () => null })
    expect(out.generatedAt).toBe('2026-11-01T00:00:00.000Z')
  })
})

describe('buildSummary', () => {
  it('totals, lifts, ranks and marks new models, and validates against the site schema', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'sum-')))
    seed(store, 'a', { alone: 8, dualkit: 18 })
    seed(store, 'b', { alone: 12, dualkit: 15 })
    const out = await buildSummary({ month: '2026-11', models: [model('a'), model('b', '2026-11')], screens, store, shots: async () => null })
    expect(out.models.map((m) => m.id)).toEqual(['a', 'b'])
    expect(out.models[0]).toMatchObject({ alone: { rulesPassed: 40, outOf: 100 }, dualkit: { rulesPassed: 90 }, lift: 50, isNew: false })
    expect(out.models[1]!.isNew).toBe(true)
    // Three identical builds tie, and cell() picks the lower middle of runs [3, 2, 1]: run 2.
    expect(out.models[0]!.screens[0]!.alone).toMatchObject({ ran: true, raw: 'bench/runs/2026-11/a/payment-summary/alone-2.json' })
    expect(parseBenchMonth(JSON.parse(JSON.stringify(out)))).toEqual(out)
  })
  it('keeps the cell and logs when the screenshot step throws', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'sum-')))
    seed(store, 'a', { alone: 8, dualkit: 18 })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const out = await buildSummary({ month: '2026-11', models: [model('a')], screens, store, shots: async () => { throw new Error('boom') } })
    expect(out.models[0]!.screens[0]!.alone).toMatchObject({ ran: true, shot: null })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('a/payment-summary/alone'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('boom'))
    warn.mockRestore()
  })
  it('shows a model with a missing screen, with null totals, ranked last', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'sum-')))
    seed(store, 'a', { alone: 8, dualkit: 18 }, ['otp/dualkit'])
    seed(store, 'b', { alone: 2, dualkit: 4 })
    const out = await buildSummary({ month: '2026-11', models: [model('a'), model('b')], screens, store, shots: async () => null })
    expect(out.models.map((m) => m.id)).toEqual(['b', 'a'])
    expect(out.models[1]).toMatchObject({ dualkit: null, lift: null })
    expect(out.models[1]!.screens.find((s) => s.id === 'otp')!.dualkit).toEqual({ ran: false, runs: 0, reasons: [] })
  })
  it('lists a model that never ran, so the page can say so', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'sum-')))
    const out = await buildSummary({ month: '2026-11', models: [model('gone')], screens, store, shots: async () => null })
    expect(out.models[0]).toMatchObject({ id: 'gone', alone: null, dualkit: null })
  })
  it('writes the month file under the site content folder', async () => {
    const site = mkdtempSync(join(tmpdir(), 'site-'))
    const store = makeStore(mkdtempSync(join(tmpdir(), 'sum-')))
    const path = writeSummary(await buildSummary({ month: '2026-11', models: [], screens, store, shots: async () => null }), site)
    expect(path).toBe(join(site, 'content', 'bench', '2026-11.json'))
    expect(JSON.parse(readFileSync(path, 'utf8')).month).toBe('2026-11')
  })
})
