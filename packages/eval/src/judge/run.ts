import { readFileSync } from 'node:fs'
import { BUDGET_SPENT, type Answer, type Ask } from '../../../cli/src/review/model'
import { cacheKey, type JudgeCache } from './cache.js'
import { loadChecklist } from './checklist.js'
import { judgePair, JUDGE_PROMPT_VERSION, type PairVerdict } from './judge.js'
import type { Against, Pair } from './pairs.js'
import { isBlank } from './render.js'

export type JudgedPair = Pair & Omit<PairVerdict, 'winner'> & { winner: PairVerdict['winner'] | 'excluded' }

type Counts = { judged: number; dualkit: number; alone: number; tie: number; inconsistent: number; failed: number; excluded: number }
/** `judged` counts pairs with a winner, a tie or an inconsistent verdict. Winner 'dualkit' means the loop page when against is loop. */
export type JudgeSummary = Counts & { against: Against; byModel: Record<string, Counts>; byScreen: Record<string, Counts> }

const EMPTY: Counts = { judged: 0, dualkit: 0, alone: 0, tie: 0, inconsistent: 0, failed: 0, excluded: 0 }

const tally = (c: Counts, r: JudgedPair): Counts => {
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
}

const verdict = (winner: PairVerdict['winner'], byDefault: boolean, error?: string): PairVerdict =>
  ({ winner, byDefault, calls: [], costUsd: 0, ...(error ? { error } : {}) })

export async function judgeAll(opts: Options): Promise<{ results: JudgedPair[]; summary: JudgeSummary; spentUsd: number }> {
  const { pairs, shootFn, seed, cache, log, modelId, isBlankFn = isBlank } = opts
  let stopped = false
  const ask = async (a: Ask): Promise<Answer> => {
    if (stopped) return { ok: false, error: BUDGET_SPENT }
    const answer = await opts.ask(a)
    if (!answer.ok && answer.error === BUDGET_SPENT) stopped = true
    return answer
  }
  // One flip per pair, drawn up front so cache hits and skips never shift later pairs.
  const rng = mulberry32(seed)
  const flips = pairs.map(() => rng() < 0.5)
  const results: JudgedPair[] = []
  let spentUsd = 0

  for (const [i, pair] of pairs.entries()) {
    const [alone, other] = await Promise.all([shootFn(pair.aloneHtml), shootFn(pair.otherHtml)])
    const [aloneBlank, otherBlank] = [isBlankFn(alone), isBlankFn(other)]
    let v: PairVerdict
    if (aloneBlank && otherBlank) v = verdict('excluded' as PairVerdict['winner'], false)
    else if (aloneBlank || otherBlank) v = verdict(aloneBlank ? 'dualkit' : 'alone', true)
    else {
      const key = cacheKey({
        aloneHtml: readFileSync(pair.aloneHtml, 'utf8'), otherHtml: readFileSync(pair.otherHtml, 'utf8'), model: modelId, version: JUDGE_PROMPT_VERSION,
      })
      const hit = cache.get(key)
      if (hit) {
        v = hit
        log(`${pair.id}: cached ${hit.winner}`)
      } else if (stopped) {
        v = verdict('failed', false, BUDGET_SPENT)
      } else {
        v = await judgePair({ checklist: loadChecklist(pair.screen), alone, other, ask, flip: flips[i] as boolean })
        spentUsd += v.costUsd
        cache.put(key, v)
        log(`${pair.id}: ${v.winner}${v.error ? ` (${v.error})` : ''}`)
      }
    }
    results.push({ ...pair, ...v } as JudgedPair)
  }
  const against = pairs[0]?.against ?? 'dualkit'
  return { results, summary: summarize(against, results), spentUsd }
}
