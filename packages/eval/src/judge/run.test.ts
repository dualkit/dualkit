import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Answer, Ask } from '../../../cli/src/review/model'
import { SCREENS } from '../../../bench/src/config'
import type { Pair } from './pairs.js'
import { fileJudgeCache, type JudgeCache } from './cache.js'
import { cacheKey } from './cache.js'
import { headline, isDailyQuota, judgeAll, QUOTA_SPENT, type JudgeSummary } from './run.js'
import type { PairVerdict } from './judge.js'

const SCREEN = SCREENS[0] as string
const dir = mkdtempSync(join(tmpdir(), 'judge-run-'))
const page = (name: string, html: string) => {
  const p = join(dir, name)
  writeFileSync(p, html)
  return p
}
const pair = (n: number, alone = `a${n}`, other = `o${n}`): Pair => ({
  id: `p${n}`, month: 'm', model: 'x', screen: SCREEN, run: n, against: 'dualkit',
  aloneHtml: page(`a${n}-${alone}.html`, alone), otherHtml: page(`o${n}-${other}.html`, other),
})
const PNG_OF = (p: string) => Buffer.from(p.includes('BLANK') ? 'blank' : 'ok')
const shootFn = async (path: string) => PNG_OF(path)
const isBlankFn = (b: Buffer) => b.toString() === 'blank'
const good = (a: Ask): Answer => ({
  ok: true, text: JSON.stringify({ points: [{ id: 'p1', left: 'pass', right: 'pass' }], pick: 'same' }), costUsd: 0.01,
})
const memCache = (): JudgeCache & { size: () => number } => {
  const m = new Map<string, PairVerdict>()
  return { get: (k) => m.get(k) ?? null, put: (k, v) => { if (v.winner !== 'failed') m.set(k, v) }, size: () => m.size }
}
const base = { shootFn, isBlankFn, seed: 1, log: () => {}, modelId: 'gemini:x' }

describe('judgeAll', () => {
  it('one blank side loses without a call', async () => {
    let calls = 0
    const ask = async (a: Ask) => { calls++; return good(a) }
    const { results } = await judgeAll({ ...base, ask, cache: memCache(), pairs: [pair(1, 'BLANK'), pair(2, 'a', 'BLANK')] })
    expect(calls).toBe(0)
    expect(results.map((r) => [r.winner, r.byDefault])).toEqual([['dualkit', true], ['alone', true]])
  })

  it('two blank sides are excluded', async () => {
    let calls = 0
    const ask = async (a: Ask) => { calls++; return good(a) }
    const { results, summary } = await judgeAll({ ...base, ask, cache: memCache(), pairs: [pair(1, 'BLANK', 'BLANK')] })
    expect(calls).toBe(0)
    expect(results[0]?.winner).toBe('excluded')
    expect(summary.excluded).toBe(1)
  })

  it('failed pairs are not cached and are not ties', async () => {
    const cache = memCache()
    const pairs = [pair(1), pair(2)]
    let fail = true
    const seen: string[] = []
    const ask = async (a: Ask): Promise<Answer> => {
      seen.push(a.text)
      return fail && a.text.length > 0 && seen.length > 2 ? { ok: false, error: 'boom' } : good(a)
    }
    // pair 1 uses calls 1-2 and succeeds; pair 2 uses calls 3-4 and fails
    const first = await judgeAll({ ...base, ask, cache, pairs })
    expect(first.results.map((r) => r.winner)).toEqual(['tie', 'failed'])
    expect(cache.size()).toBe(1)
    fail = false
    seen.length = 0
    const second = await judgeAll({ ...base, ask, cache, pairs })
    expect(seen.length).toBe(2)
    expect(second.results.map((r) => r.winner)).toEqual(['tie', 'tie'])
  })

  it('cache hits cost nothing', async () => {
    const cache = memCache()
    const ask = async (a: Ask) => good(a)
    const first = await judgeAll({ ...base, ask, cache, pairs: [pair(1)] })
    expect(first.spentUsd).toBeCloseTo(0.02)
    let calls = 0
    const second = await judgeAll({ ...base, ask: async (a) => { calls++; return good(a) }, cache, pairs: [pair(1)] })
    expect(calls).toBe(0)
    expect(second.spentUsd).toBe(0)
    expect(second.results[0]?.winner).toBe('tie')
  })

  it('works with the file cache', async () => {
    const cache = fileJudgeCache(join(dir, 'cache'))
    await judgeAll({ ...base, ask: async (a) => good(a), cache, pairs: [pair(1)] })
    let calls = 0
    await judgeAll({ ...base, ask: async (a) => { calls++; return good(a) }, cache, pairs: [pair(1)] })
    expect(calls).toBe(0)
  })

  it('the same seed asks the same way', async () => {
    const order = async (seed: number) => {
      const firsts: string[] = []
      const ask = async (a: Ask) => { firsts.push(a.images[0]?.base64 ?? ''); return good(a) }
      const pairs = [1, 2, 3, 4, 5, 6].map((n) => pair(n))
      const shoot = async (p: string) => Buffer.from(p)
      await judgeAll({ ...base, shootFn: shoot, seed, ask, cache: memCache(), pairs })
      return firsts
    }
    expect(await order(7)).toEqual(await order(7))
    expect(await order(7)).not.toEqual(await order(8))
  })

  it('a spent budget stops the run and the rest fail', async () => {
    let calls = 0
    const ask = async (): Promise<Answer> => { calls++; return { ok: false, error: 'Monthly review budget spent' } }
    const { results } = await judgeAll({ ...base, ask, cache: memCache(), pairs: [pair(1), pair(2), pair(3)] })
    expect(results.map((r) => r.winner)).toEqual(['failed', 'failed', 'failed'])
    expect(calls).toBeLessThanOrEqual(2)
  })
})

describe('judgeAll resilience', () => {
  it('a throwing shootFn records failed with the error and the run continues', async () => {
    const shoot = async (p: string) => {
      if (p.includes('o1-')) throw new Error('browser crashed')
      return PNG_OF(p)
    }
    const { results } = await judgeAll({ ...base, shootFn: shoot, ask: async (a) => good(a), cache: memCache(), pairs: [pair(1), pair(2)] })
    expect(results.map((r) => r.winner)).toEqual(['failed', 'tie'])
    expect(results[0]?.error).toBe('browser crashed')
  })

  it('a throwing ask records failed and the run continues', async () => {
    let n = 0
    const ask = async (a: Ask): Promise<Answer> => {
      if (n++ < 2) throw new Error('network down')
      return good(a)
    }
    const { results } = await judgeAll({ ...base, ask, cache: memCache(), pairs: [pair(1), pair(2)] })
    expect(results.map((r) => r.winner)).toEqual(['failed', 'tie'])
    expect(results[0]?.error).toBe('network down')
  })

  it('a daily quota 429 stops further asks and the rest fail with a clear error', async () => {
    let calls = 0
    const ask = async (): Promise<Answer> => {
      calls++
      return { ok: false, error: 'Gemini 429: You exceeded your current quota, please check your plan' }
    }
    const { results } = await judgeAll({ ...base, ask, cache: memCache(), pairs: [pair(1), pair(2), pair(3)] })
    expect(results.map((r) => r.winner)).toEqual(['failed', 'failed', 'failed'])
    expect(results.map((r) => r.error)).toEqual([QUOTA_SPENT, QUOTA_SPENT, QUOTA_SPENT])
    expect(calls).toBeLessThanOrEqual(2)
  })

  it('RESOURCE_EXHAUSTED counts only when it is a per-day quota', () => {
    expect(isDailyQuota('RESOURCE_EXHAUSTED: GenerateRequestsPerDayPerProjectPerModel-FreeTier')).toBe(true)
    expect(isDailyQuota('RESOURCE_EXHAUSTED: requests per minute')).toBe(false)
    expect(isDailyQuota('HTTP 500')).toBe(false)
  })

  it('reports progress after every pair so a killed run keeps its results', async () => {
    const seen: number[] = []
    const { results } = await judgeAll({
      ...base, ask: async (a) => good(a), cache: memCache(), pairs: [pair(1), pair(2), pair(3)],
      onProgress: (rs) => seen.push(rs.length),
    })
    expect(seen).toEqual([1, 2, 3])
    expect(results).toHaveLength(3)
  })

  it('a checklist edit does not reuse a cached verdict', () => {
    const k = (checklist: string) => cacheKey({ aloneHtml: 'a', otherHtml: 'o', model: 'm', version: '1', checklist })
    expect(k('a')).not.toBe(k('b'))
  })
})

describe('headline', () => {
  it('counts wins by default apart from blind side-by-sides', async () => {
    const { summary } = await judgeAll({ ...base, ask: async (a) => good(a), cache: memCache(), pairs: [pair(1, 'BLANK'), pair(2)] })
    expect(summary.byDefault).toBe(1)
    expect(summary.dualkit).toBe(0)
    expect(summary.judged).toBe(1)
    expect(headline(summary)).toBe('Dualkit wins 0 of 1 blind side-by-sides')
  })

  it('leaves out failed and excluded pairs', () => {
    const s: JudgeSummary = {
      against: 'dualkit', judged: 10, dualkit: 5, alone: 2, tie: 1, inconsistent: 0, failed: 1, excluded: 1, byDefault: 0, byModel: {}, byScreen: {},
    }
    expect(headline(s)).toBe('Dualkit wins 5 of 8 blind side-by-sides')
  })
})
