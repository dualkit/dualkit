import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseBenchMonth } from '../../../apps/site/lib/bench-schema'
import { loadScreens, type ModelEntry } from '../src/config'
import { fakeGenerate } from '../src/fake'
import { runBench } from '../src/run'
import { makeStore } from '../src/store'
import { buildSummary, writeSummary } from '../src/summary'

const model = (id: string): ModelEntry => ({ id, provider: 'openrouter', model: id, label: id, since: '2026-11' })

describe('the real path, end to end', () => {
  it('builds, scores in Chromium, saves screenshots, summarises, copies shots and passes the site schema', async () => {
    const screens = loadScreens().filter((s) => s.id === 'payment-summary')
    const store = makeStore(mkdtempSync(join(tmpdir(), 'e2e-runs-')))
    const site = mkdtempSync(join(tmpdir(), 'e2e-site-'))
    const models = [model('fake-good'), model('fake-incomplete')]
    // No score option: the real scoreHtml, with the shared Chromium.
    const out = await runBench({ month: '2026-11', models, screens, generate: fakeGenerate, store })
    expect(out).toEqual({ built: 12, skipped: 0, failed: 0, stoppedEarly: false })
    const summary = await buildSummary({ month: '2026-11', models, screens, store, siteRoot: site })
    const parsed = parseBenchMonth(JSON.parse(JSON.stringify(summary)))
    expect(existsSync(writeSummary(summary, site))).toBe(true)

    const good = parsed.models.find((m) => m.id === 'fake-good')!
    const cell = good.screens[0]!.alone
    expect(cell.ran).toBe(true)
    if (!cell.ran) return
    expect(cell.missing).toEqual([])
    expect(cell.shot).toBe('/bench/2026-11/fake-good/payment-summary-alone.webp')
    expect(existsSync(join(site, 'public', cell.shot!))).toBe(true)
    expect(cell.pageHeight).toBeGreaterThan(0)

    const incomplete = parsed.models.find((m) => m.id === 'fake-incomplete')!
    expect(incomplete.alone).toMatchObject({ rulesPassed: 0, score: 0 })
    expect(incomplete.dualkit).toMatchObject({ rulesPassed: 0, score: 0 })
  }, 90_000)
})
