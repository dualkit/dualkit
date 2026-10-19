import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
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
    store.write({ ...k, at: 'now', reply: 'r', usage: null, ms: 1, ok: true, rulesPassed: passed[condition], score: passed[condition] * 4, missing: [], findings: [] }, '<html></html>')
  }
}

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
  it('shows a model with a missing screen, with null totals, ranked last', async () => {
    const store = makeStore(mkdtempSync(join(tmpdir(), 'sum-')))
    seed(store, 'a', { alone: 8, dualkit: 18 }, ['otp/dualkit'])
    seed(store, 'b', { alone: 2, dualkit: 4 })
    const out = await buildSummary({ month: '2026-11', models: [model('a'), model('b')], screens, store, shots: async () => null })
    expect(out.models.map((m) => m.id)).toEqual(['b', 'a'])
    expect(out.models[1]).toMatchObject({ dualkit: null, lift: null })
    expect(out.models[1]!.screens.find((s) => s.id === 'otp')!.dualkit).toEqual({ ran: false, runs: 0 })
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
