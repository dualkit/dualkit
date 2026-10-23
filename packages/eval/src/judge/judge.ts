import type { Answer, Ask } from '../../../cli/src/review/model'
import { parseJson } from '../../../cli/src/review/position'
import type { Checklist } from './checklist.js'

export const JUDGE_PROMPT_VERSION = '1'

export type Mark = 'pass' | 'fail' | 'na'
export type Side = 'left' | 'right'
export type CallVerdict = { points: { id: string; left: Mark; right: Mark }[]; pick: Side | 'same' }
export type Winner = 'dualkit' | 'alone' | 'tie' | 'inconsistent' | 'failed'
export type PairVerdict = { winner: Winner; byDefault: boolean; calls: (CallVerdict | null)[]; costUsd: number; error?: string }

const MARKS: readonly string[] = ['pass', 'fail', 'na']
const PICKS: readonly string[] = ['left', 'right', 'same']

const SYSTEM = `You are comparing two screenshots of the same Arabic app screen. Image 1 is on the left and image 2 is on the right.

Judge as a native Arabic reader would. Right-to-left norms apply: reading and flow start on the right, back arrows point right, and a calendar week starts on Saturday. Judge only what is visible in the screenshots. Do not guess at anything hidden or off screen.

You get a checklist of points. For each point, mark image 1 (left) and image 2 (right) separately:
- "pass": the point is clearly met.
- "fail": the point is clearly not met.
- "na": there is nothing to look at for this point on that screenshot.

Then pick the better Arabic app overall: "left", "right" or "same". Base the pick on the checklist marks first, and use your overall impression only when the marks are even.

Reply with JSON only, no other text, in exactly this shape:
{"points":[{"id":"p1","left":"pass","right":"fail"}],"pick":"left"}
Include every checklist id once.`

export const buildJudgeAsk = (checklist: Checklist, left: Buffer, right: Buffer): Ask => ({
  system: SYSTEM,
  text: `Screen: ${checklist.screen}\nImage 1 is left, image 2 is right.\n\nChecklist:\n${checklist.points.map((p) => `${p.id}: ${p.text}`).join('\n')}`,
  images: [left, right].map((b) => ({ mime: 'image/png' as const, base64: b.toString('base64') })),
})

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

export function parseVerdict(text: string, checklist: Checklist): CallVerdict | null {
  const parsed = parseJson(text)
  if (!isObject(parsed) || typeof parsed.pick !== 'string' || !PICKS.includes(parsed.pick)) return null
  const list: unknown[] = Array.isArray(parsed.points) ? parsed.points : []
  const marks = new Map<string, { left: Mark; right: Mark }>()
  for (const entry of list) {
    if (!isObject(entry)) return null
    const { id, left, right } = entry
    if (typeof left !== 'string' || typeof right !== 'string' || !MARKS.includes(left) || !MARKS.includes(right)) return null
    if (typeof id === 'string') marks.set(id, { left: left as Mark, right: right as Mark })
  }
  return {
    points: checklist.points.map((p) => ({ id: p.id, ...(marks.get(p.id) ?? { left: 'na' as Mark, right: 'na' as Mark }) })),
    pick: parsed.pick as CallVerdict['pick'],
  }
}

const passes = (v: CallVerdict, side: Side) => v.points.filter((p) => p[side] === 'pass').length
const byPoints = (v: CallVerdict): Side | 'same' => {
  const l = passes(v, 'left')
  const r = passes(v, 'right')
  return l === r ? 'same' : l > r ? 'left' : 'right'
}

/** More passes wins; the holistic pick only breaks a tie. */
export const decide = (v: CallVerdict): Side | 'same' => {
  const p = byPoints(v)
  return p === 'same' ? v.pick : p
}

export async function judgePair(input: {
  checklist: Checklist
  alone: Buffer
  other: Buffer
  ask: (a: Ask) => Promise<Answer>
  flip: boolean
}): Promise<PairVerdict> {
  const { checklist, alone, other, ask, flip } = input
  // aloneLeft per call: call 1 follows flip, call 2 swaps.
  const plans = [!flip, flip]
  const answers = await Promise.all(
    plans.map((aloneLeft) => ask(aloneLeft ? buildJudgeAsk(checklist, alone, other) : buildJudgeAsk(checklist, other, alone))),
  )
  const costUsd = answers.reduce((sum, a) => sum + (a.ok ? a.costUsd : 0), 0)
  const calls = answers.map((a) => (a.ok ? parseVerdict(a.text, checklist) : null))
  const failure = answers.map((a, i) => (!a.ok ? a.error : calls[i] ? null : 'Judge reply was not valid JSON')).find((e) => e !== null)
  if (failure !== undefined) return { winner: 'failed', byDefault: false, calls, costUsd, error: failure }

  const results = calls.map((c, i) => {
    const v = c as CallVerdict
    const d = decide(v)
    const aloneLeft = plans[i]
    const who = d === 'same' ? 'same' : (d === 'left') === aloneLeft ? 'alone' : 'dualkit'
    return who
  })
  const [a, b] = results
  const winner: Winner = a === b ? (a === 'same' ? 'tie' : (a as Winner)) : 'inconsistent'
  // byDefault is for blank-side wins decided without a call (set elsewhere); a judged pair is never one.
  return { winner, byDefault: false, calls, costUsd }
}
