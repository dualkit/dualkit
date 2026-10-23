import { readFileSync } from 'node:fs'
import { BUDGET_SPENT, type Answer, type Ask } from '../../../cli/src/review/model'
import { cacheKey, type JudgeCache } from './cache.js'
import { loadChecklist } from './checklist.js'
import { judgePair, JUDGE_PROMPT_VERSION, type PairVerdict } from './judge.js'
import type { Against, Pair } from './pairs.js'
import { isBlank } from './render.js'

/** Gemini free tier: the daily request quota. Retrying today cannot work. */
export const QUOTA_SPENT = 'Free daily quota spent'
export const isDailyQuota = (error: string): boolean =>
  /exceeded your current quota/i.test(error) || (/RESOURCE_EXHAUSTED/.test(error) && /per.?day/i.test(error))

export type JudgedPair = Pair & Omit<PairVerdict, 'winner'> & { winner: PairVerdict['winner'] | 'excluded' }

type Counts = { judged: number; dualkit: number; alone: number; tie: number; inconsistent: number; failed: number; excluded: number; byDefault: number }
/** `judged` counts real side-by-sides: a winner, a tie or an inconsistent verdict. Wins by default (a blank page on one side) are counted apart in `byDefault`. Winner 'dualkit' means the loop page when against is loop. */
export type JudgeSummary = Counts & { against: Against; byModel: Record<string, Counts>; byScreen: Record<string, Counts> }

const EMPTY: Counts = { judged: 0, dualkit: 0, alone: 0, tie: 0, inconsistent: 0, failed: 0, excluded: 0, byDefault: 0 }

const tally = (c: Counts, r: JudgedPair): Counts => {
  if (r.byDefault && (r.winner === 'dualkit' || r.winner === 'alone')) return { ...c, byDefault: c.byDefault + 1 }
  const next = { ...c, [r.winner]: c[r.winner] + 1 }
  return r.winner === 'failed' || r.winner === 'excluded' ? next : { ...next, judged: next.judged + 1 }
}

const group = (rs: JudgedPair[], key: (r: JudgedPair) => string): Record<string, Counts> =>
  rs.reduce<Record<string, Counts>>((acc, r) => ({ ...acc, [key(r)]: tally(acc[key(r)] ?? EMPTY, r) }), {})

export const summarize = (against: Against, rs: JudgedPair[]): JudgeSummary => ({
  against,
  ...rs.reduce(tally, EMPTY),
  byModel: group(rs, (r) => r.model),
  byScreen: group(rs, (r) => r.screen),
})

export const headline = (s: Pick<Counts, 'dualkit' | 'alone' | 'tie' | 'inconsistent'>): string =>
  // By-default wins (a blank page on one side) are not comparisons, so they are not in here.
  `Dualkit wins ${s.dualkit} of ${s.dualkit + s.alone + s.tie + s.inconsistent} blind side-by-sides`

/** mulberry32: small, seeded, deterministic. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Options = {
  pairs: Pair[]
  ask: (a: Ask) => Promise<Answer>
  shootFn: (htmlPath: string) => Promise<Buffer>
  seed: number
  cache: JudgeCache
  log: (line: string) => void
  /** Provider and model, part of the cache key. */
  modelId: string
  isBlankFn?: (png: Buffer) => boolean
  /** Called after every pair with all results so far, so the caller can save partial work. */
  onProgress?: (results: readonly JudgedPair[]) => void
}

const verdict = (winner: PairVerdict['winner'], byDefault: boolean, error?: string): PairVerdict =>
  ({ winner, byDefault, calls: [], costUsd: 0, ...(error ? { error } : {}) })

export async function judgeAll(opts: Options): Promise<{ results: JudgedPair[]; summary: JudgeSummary; spentUsd: number }> {
  const { pairs, shootFn, seed, cache, log, modelId, isBlankFn = isBlank } = opts
  let stopped: string | null = null
  const ask = async (a: Ask): Promise<Answer> => {
    if (stopped) return { ok: false, error: stopped }
    const answer = await opts.ask(a)
    if (answer.ok) return answer
    if (answer.error === BUDGET_SPENT) stopped = BUDGET_SPENT
    else if (isDailyQuota(answer.error)) {
      stopped = QUOTA_SPENT
      return { ok: false, error: QUOTA_SPENT }
    }
    return answer
  }
  // One flip per pair, drawn up front so cache hits and skips never shift later pairs.
  const rng = mulberry32(seed)
  const flips = pairs.map(() => rng() < 0.5)
  const results: JudgedPair[] = []
  let spentUsd = 0

  async function judgeOne(pair: Pair, flip: boolean): Promise<PairVerdict> {
    const [alone, other] = await Promise.all([shootFn(pair.aloneHtml), shootFn(pair.otherHtml)])
    const [aloneBlank, otherBlank] = [isBlankFn(alone), isBlankFn(other)]
    if (aloneBlank && otherBlank) return verdict('excluded' as PairVerdict['winner'], false)
    if (aloneBlank || otherBlank) return verdict(aloneBlank ? 'dualkit' : 'alone', true)
    const checklist = loadChecklist(pair.screen)
    const key = cacheKey({
      aloneHtml: readFileSync(pair.aloneHtml, 'utf8'), otherHtml: readFileSync(pair.otherHtml, 'utf8'),
      model: modelId, version: JUDGE_PROMPT_VERSION, checklist: JSON.stringify(checklist),
    })
    const hit = cache.get(key)
    if (hit) {
      log(`${pair.id}: cached ${hit.winner}`)
      return hit
    }
    if (stopped) return verdict('failed', false, stopped)
    const v = await judgePair({ checklist, alone, other, ask, flip })
    spentUsd += v.costUsd
    cache.put(key, v)
    log(`${pair.id}: ${v.winner}${v.error ? ` (${v.error})` : ''}`)
    return v
  }

  for (const [i, pair] of pairs.entries()) {
    let v: PairVerdict
    try {
      v = await judgeOne(pair, flips[i] as boolean)
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      log(`${pair.id}: failed (${error})`)
      v = verdict('failed', false, error)
    }
    results.push({ ...pair, ...v } as JudgedPair)
    opts.onProgress?.([...results])
  }
  const against = pairs[0]?.against ?? 'dualkit'
  return { results, summary: summarize(against, results), spentUsd }
}
