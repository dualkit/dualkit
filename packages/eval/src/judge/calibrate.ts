import { mulberry32 } from './run.js'
import type { Winner } from './judge.js'
import type { Pair } from './pairs.js'

export type Key = { slot: number; pairId: string; leftIs: 'alone' | 'dualkit' }[]
export type SamAnswer = { slot: number; pick: 'left' | 'right' | 'same' }
export type AgreementRow = { slot: number; pairId: string; sam: SamAnswer['pick'] | 'unanswered'; judge: Winner | 'missing'; agrees: boolean }

const PER_SCREEN = 2
const MODEL_CAP = 5
export const PASS_AT = 16

const shuffled = <T>(xs: T[], rng: () => number): T[] => {
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j] as T, out[i] as T]
  }
  return out
}

/** Alone-against-dualkit pairs, non-blank, two per screen, models spread so none passes the cap. */
export async function pickCalibration(
  pairs: Pair[], isBlankPair: (p: Pair) => Promise<boolean>, n = 20, seed = 7,
): Promise<Pair[]> {
  const rng = mulberry32(seed)
  const eligible = pairs.filter((p) => p.against === 'dualkit')
  const screens = [...new Set(eligible.map((p) => p.screen))].sort()
  const chosen = shuffled(screens, rng).slice(0, Math.ceil(n / PER_SCREEN)).sort()
  const counts = new Map<string, number>()
  const picked: Pair[] = []
  for (const screen of chosen) {
    const pool = shuffled(eligible.filter((p) => p.screen === screen), rng)
    for (let k = 0; k < PER_SCREEN && picked.length < n; k++) {
      // Fewest picks first, then model name, so models are taken round robin in sorted order.
      const order = [...pool].sort((a, b) => (counts.get(a.model) ?? 0) - (counts.get(b.model) ?? 0) || (a.model < b.model ? -1 : a.model > b.model ? 1 : 0))
      for (const p of order) {
        if ((counts.get(p.model) ?? 0) >= MODEL_CAP || picked.includes(p)) continue
        if (await isBlankPair(p)) {
          pool.splice(pool.indexOf(p), 1)
          continue
        }
        picked.push(p)
        counts.set(p.model, (counts.get(p.model) ?? 0) + 1)
        break
      }
    }
  }
  if (picked.length < n) throw new Error(`Only found ${picked.length} usable pairs for the calibration page, need ${n}.`)
  return picked
}

/** Which side holds which condition, drawn from its own seeded PRNG. */
export const makeKey = (pairs: Pair[], seed = 11): Key => {
  const rng = mulberry32(seed)
  return pairs.map((p, i) => ({ slot: i + 1, pairId: p.id, leftIs: rng() < 0.5 ? 'alone' : 'dualkit' }))
}

const agrees = (pick: SamAnswer['pick'], leftIs: Key[number]['leftIs'], w: Winner | 'missing'): boolean => {
  if (w === 'failed' || w === 'missing') return false
  if (pick === 'same') return w === 'tie' || w === 'inconsistent'
  const samWants = pick === 'left' ? leftIs : leftIs === 'alone' ? 'dualkit' : 'alone'
  return w === samWants
}

export function agreement(key: Key, sam: SamAnswer[], judged: Record<string, Winner>) {
  const rows: AgreementRow[] = key.map((k) => {
    const pick = sam.find((a) => a.slot === k.slot)?.pick
    const judge = judged[k.pairId] ?? 'missing'
    return { slot: k.slot, pairId: k.pairId, sam: pick ?? 'unanswered', judge, agrees: pick !== undefined && agrees(pick, k.leftIs, judge) }
  })
  const agree = rows.filter((r) => r.agrees).length
  return { agree, total: key.length, passed: agree >= PASS_AT, rows }
}

const PICKS: readonly string[] = ['left', 'right', 'same']

/** Checks Sam's answers file against the key; throws a plain error naming the first bad entry. */
export function parseAnswers(given: unknown, key: Key): SamAnswer[] {
  const list = (given as { answers?: unknown } | null)?.answers
  if (!Array.isArray(list)) throw new Error('The answers file needs an "answers" list.')
  const slots = new Set(key.map((k) => k.slot))
  const seen = new Set<number>()
  return list.map((entry: unknown, i) => {
    const { slot, pick } = (entry ?? {}) as { slot?: unknown; pick?: unknown }
    if (typeof slot !== 'number' || !slots.has(slot)) throw new Error(`Answer ${i + 1} has slot ${JSON.stringify(slot)}, which is not one of the ${key.length} slots in key.json.`)
    if (typeof pick !== 'string' || !PICKS.includes(pick)) throw new Error(`Answer for slot ${slot} has pick ${JSON.stringify(pick)}, it must be left, right or same.`)
    if (seen.has(slot)) throw new Error(`Slot ${slot} is answered more than once.`)
    seen.add(slot)
    return { slot, pick: pick as SamAnswer['pick'] }
  })
}

/** Wraps a pair check so a throw (a shot that fails) logs the pair and counts as unusable, and the pick moves on. */
export const skipOnError = (check: (p: Pair) => Promise<boolean>, log: (line: string) => void) => async (p: Pair): Promise<boolean> => {
  try {
    return await check(p)
  } catch (e) {
    log(`Skipping ${p.id}: ${e instanceof Error ? e.message : String(e)}`)
    return true
  }
}
