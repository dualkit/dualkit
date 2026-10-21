import { describe, expect, it } from 'vitest'
import type { ModelEntry, Screen } from '../src/config'
import { RULE_COUNT } from '../src/score'
import type { BuildRecord, Condition, Round } from '../src/store'
import { renderStudy, study } from '../src/study'

const model = (id: string): ModelEntry => ({ id, provider: 'openrouter', model: id, label: id.toUpperCase(), since: '2026-10', by: 'Fake', mark: 'google' })
const screens: Screen[] = [{ id: 's1', title: 'One', prompt: 'p', required: [] }, { id: 's2', title: 'Two', prompt: 'p', required: [] }]
const models = [model('a'), model('b'), model('c')]

const round = (over: Partial<Round> = {}): Round => ({
  at: '2026-11-01T05:00:00.000Z', ms: 1, usage: null, reply: 'r', ok: true, error: null, sent: 3,
  rulesPassed: 20, score: 80, missing: [], regressed: [], lostParts: [], arabicKept: 1, ...over,
})
const failedRound = (): Round => round({ ok: false, error: 'No HTML in the reply', rulesPassed: null, score: null, arabicKept: null })

function rec(m: string, screen: string, condition: Condition, run: number, rulesPassed: number, extra: { missing?: string[]; rounds?: Round[] } = {}): BuildRecord {
  return {
    month: '2026-11', model: m, screen, condition, run, at: '2026-11-01T04:30:00.000Z', reply: 'r', usage: null, ms: 1, finish: 'stop', reasoningTokens: 0, servedModel: m,
    ok: true, rulesPassed, score: rulesPassed * 4, missing: extra.missing ?? [], findings: [], unreadableStylesheets: 0, pageHeight: 900,
    ...(condition === 'loop' ? { from: { rulesPassed: 0, score: 0 }, rounds: extra.rounds ?? [] } : {}),
  }
}
/** Three runs per screen and condition, every run passing the same count. */
const seed = (m: string, passed: Record<Condition, number>, skip: string[] = []) =>
  screens.flatMap((s) => (['alone', 'dualkit', 'loop'] as const).flatMap((c) => (skip.includes(`${s.id}/${c}`) ? [] : [1, 2, 3].map((run) => rec(m, s.id, c, run, passed[c])))))

const base = [
  // a fails 10 rules alone, 6 with skills and 4 with the loop on each screen: halved.
  ...seed('a', { alone: RULE_COUNT - 10, dualkit: RULE_COUNT - 6, loop: RULE_COUNT - 4 }),
  // b fails 10, 8 and 6: not halved.
  ...seed('b', { alone: RULE_COUNT - 10, dualkit: RULE_COUNT - 8, loop: RULE_COUNT - 6 }),
  // c has no loop builds for s2, so its loop total is unknown.
  ...seed('c', { alone: RULE_COUNT - 10, dualkit: RULE_COUNT - 6, loop: RULE_COUNT - 2 }, ['s2/loop']),
]

describe('study', () => {
  it('sums failed rules from the median cells and marks a model halved when the loop fails half or fewer of alone', () => {
    const s = study(base, models, screens)
    expect(s.models).toEqual([
      { id: 'a', label: 'A', failed: { alone: 20, dualkit: 12, loop: 8 }, halved: true },
      { id: 'b', label: 'B', failed: { alone: 20, dualkit: 16, loop: 12 }, halved: false },
      { id: 'c', label: 'C', failed: { alone: 20, dualkit: 12, loop: null }, halved: null },
    ])
    expect(s.modelsHalved).toBe(1)
    expect(s.pass.gain).toBe(false)
  })
  it('counts an incomplete build as failing every rule, as the bench cells do', () => {
    const records = [
      ...seed('a', { alone: RULE_COUNT - 10, dualkit: RULE_COUNT - 6, loop: RULE_COUNT - 4 }, ['s1/loop']),
      ...[1, 2, 3].map((run) => rec('a', 's1', 'loop', run, RULE_COUNT, { missing: ['total'] })),
    ]
    const s = study(records, [model('a')], screens)
    expect(s.models[0]!.failed.loop).toBe(RULE_COUNT + 4)
    expect(s.incomplete).toEqual({ dualkit: 0, loop: 3 })
    expect(s.pass.honest).toBe(false)
  })
  it('passes gain with four models halved', () => {
    const four = ['a', 'b', 'c', 'd'].flatMap((m) => seed(m, { alone: RULE_COUNT - 10, dualkit: RULE_COUNT - 8, loop: RULE_COUNT - 5 }))
    const s = study(four, ['a', 'b', 'c', 'd'].map(model), screens)
    expect(s.modelsHalved).toBe(4)
    expect(s.pass.gain).toBe(true)
  })
  it('takes the harm rate over rounds that ran and rendered, and counts shrunk Arabic apart from it', () => {
    const rounds = [
      round(), round({ regressed: ['contrast'] }), round({ lostParts: ['total'] }), round({ arabicKept: 0.5 }),
      failedRound(), failedRound(),
    ]
    const records = [...base, rec('a', 's1', 'loop', 4, RULE_COUNT, { rounds })]
    const s = study(records, models, screens)
    expect(s.rounds).toBe(4)
    expect(s.harmfulRounds).toBe(2)
    expect(s.harmRate).toBe(0.5)
    expect(s.shrunk).toBe(1)
    expect(s.pass.harm).toBe(false)
  })
  it('passes harm at 10 per cent or less', () => {
    const rounds = [round({ regressed: ['contrast'] }), ...Array.from({ length: 9 }, () => round())]
    const s = study([...base, rec('a', 's1', 'loop', 4, RULE_COUNT, { rounds })], models, screens)
    expect(s.harmRate).toBe(0.1)
    expect(s.pass.harm).toBe(true)
  })
  it('has no harm rate and fails the harm bar when no round ran', () => {
    const s = study(base, models, screens)
    expect(s.rounds).toBe(0)
    expect(s.harmRate).toBeNull()
    expect(s.pass.harm).toBe(false)
  })
  it('counts ok builds with missing parts per setup, and passes honest when the loop has no more', () => {
    const records = [...base, rec('a', 's1', 'dualkit', 4, 0, { missing: ['x'] }), rec('b', 's1', 'dualkit', 4, 0, { missing: ['x'] }), rec('a', 's1', 'loop', 4, 0, { missing: ['x'] })]
    const s = study(records, models, screens)
    expect(s.incomplete).toEqual({ dualkit: 2, loop: 1 })
    expect(s.pass.honest).toBe(true)
  })
  it('ignores records of models and screens it was not given', () => {
    const records = [...base, rec('zz', 's1', 'dualkit', 1, 0, { missing: ['x'] }), rec('a', 'other', 'loop', 1, 0, { rounds: [round({ regressed: ['x'] })] })]
    const s = study(records, models, screens)
    expect(s.incomplete.dualkit).toBe(0)
    expect(s.rounds).toBe(0)
  })
})

describe('renderStudy', () => {
  it('prints the table, the three bars and the shrunk count', () => {
    const rounds = [round(), round({ regressed: ['contrast'] }), round({ arabicKept: 0.8 }), failedRound()]
    const s = study([...base, rec('a', 's1', 'loop', 4, RULE_COUNT, { rounds })], models, screens)
    expect(renderStudy(s)).toMatchInlineSnapshot(`
      "| Model | Failed alone | With skills | With loop | Halved |
      | --- | ---: | ---: | ---: | --- |
      | A | 20 | 12 | 8 | yes |
      | B | 20 | 16 | 12 | no |
      | C | 20 | 12 | did not run | n/a |

      - Gain: 1 of 3 models at least halved their failed rules with the loop (needs 4): fail
      - Harm: 1 of 3 fix rounds that ran and rendered made something worse, 33.3% (needs 10% or less): fail
      - Honest: 0 incomplete builds with the loop, 0 with skills (needs no more with the loop): pass

      Shrunk Arabic: 1 of 3 rounds kept less than 90% of the Arabic text. Information, not a bar."
    `)
  })
})
