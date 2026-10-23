import { describe, expect, it } from 'vitest'
import { agreement, parseAnswers, pickCalibration, skipOnError, type Key, type SamAnswer } from './calibrate.js'
import { calibrationPage } from './calibrate-page.js'
import type { Winner } from './judge.js'
import type { Pair } from './pairs.js'

const MODELS = ['m1', 'm2', 'm3', 'm4', 'm5']
const SCREENS = Array.from({ length: 10 }, (_, i) => `screen-${i}`)
const mk = (model: string, screen: string, run: number, against: 'dualkit' | 'loop' = 'dualkit'): Pair => ({
  id: `2026-10/${model}/${screen}/${run}/${against}`, month: '2026-10', model, screen, run, against,
  aloneHtml: `/x/${model}/${screen}/alone-${run}.html`, otherHtml: `/x/${model}/${screen}/${against}-${run}.html`,
})
const synthetic = (): Pair[] => SCREENS.flatMap((s) => MODELS.flatMap((m) => [1, 2].map((r) => mk(m, s, r))))
const never = async () => false

describe('pickCalibration', () => {
  it('picks two per screen and no model more than five', async () => {
    const picked = await pickCalibration(synthetic(), never)
    expect(picked).toHaveLength(20)
    for (const s of SCREENS) expect(picked.filter((p) => p.screen === s)).toHaveLength(2)
    for (const m of MODELS) expect(picked.filter((p) => p.model === m).length).toBeLessThanOrEqual(5)
    expect(await pickCalibration(synthetic(), never)).toEqual(picked)
  })
  it('skips blank pairs and loop pairs', async () => {
    const blank = new Set(['m1'])
    const pairs = [...synthetic(), ...SCREENS.map((s) => mk('m1', s, 3, 'loop'))]
    const picked = await pickCalibration(pairs, async (p) => blank.has(p.model))
    expect(picked).toHaveLength(20)
    expect(picked.some((p) => blank.has(p.model) || p.against === 'loop')).toBe(false)
  })
})

describe('calibrationPage', () => {
  const items = Array.from({ length: 20 }, (_, i) => ({
    slot: i + 1, left: Buffer.from('L'), right: Buffer.from('R'),
    checklist: { screen: 'screen-0', points: [{ id: 'p1', text: 'Text reads right to left' }] },
  }))
  it('the page is blind', () => {
    const html = calibrationPage(items)
    expect(html).not.toMatch(/dualkit|alone|gemini|minimax|laguna|dots|nemotron|2026-10/i)
    expect(html).not.toContain('—')
    expect(html.match(/class="slot"/g)).toHaveLength(20)
    expect(html).toContain('Which is the better Arabic app?')
  })
})

describe('agreement', () => {
  const key: Key = [
    { slot: 1, pairId: 'a', leftIs: 'dualkit' },
    { slot: 2, pairId: 'b', leftIs: 'alone' },
  ]
  const run = (sam: SamAnswer[], judged: Record<string, Winner>) => agreement(key, sam, judged)
  it('agreement maps sides through the key', () => {
    const r = run([{ slot: 1, pick: 'left' }, { slot: 2, pick: 'left' }], { a: 'dualkit', b: 'dualkit' })
    expect(r.agree).toBe(1)
    expect(r.rows.filter((x) => !x.agrees).map((x) => x.slot)).toEqual([2])
    expect(run([{ slot: 1, pick: 'right' }, { slot: 2, pick: 'right' }], { a: 'alone', b: 'dualkit' }).agree).toBe(2)
  })
  it('same agrees with tie and inconsistent, failed never agrees', () => {
    const sam: SamAnswer[] = [{ slot: 1, pick: 'same' }, { slot: 2, pick: 'same' }]
    expect(run(sam, { a: 'tie', b: 'inconsistent' }).agree).toBe(2)
    expect(run(sam, { a: 'failed', b: 'dualkit' }).agree).toBe(0)
    expect(run([{ slot: 1, pick: 'left' }, { slot: 2, pick: 'left' }], { a: 'failed', b: 'failed' }).agree).toBe(0)
  })
  it('16 of 20 passes and 15 does not', () => {
    const k: Key = Array.from({ length: 20 }, (_, i) => ({ slot: i + 1, pairId: `p${i}`, leftIs: 'dualkit' as const }))
    const judged = Object.fromEntries(k.map((x) => [x.pairId, 'dualkit' as Winner]))
    const sam = (n: number): SamAnswer[] => k.map((x) => ({ slot: x.slot, pick: x.slot <= n ? 'left' : 'right' }))
    expect(agreement(k, sam(16), judged)).toMatchObject({ agree: 16, total: 20, passed: true })
    expect(agreement(k, sam(15), judged)).toMatchObject({ agree: 15, passed: false })
  })
})

describe('parseAnswers', () => {
  const key: Key = [{ slot: 1, pairId: 'a', leftIs: 'alone' }, { slot: 2, pairId: 'b', leftIs: 'dualkit' }]
  it('accepts good answers, even partial', () => {
    expect(parseAnswers({ answers: [{ slot: 2, pick: 'same' }] }, key)).toEqual([{ slot: 2, pick: 'same' }])
  })
  it.each([
    [{}, /answers/],
    [{ answers: [{ slot: 1, pick: 'middle' }] }, /left, right or same/],
    [{ answers: [{ slot: 3, pick: 'left' }] }, /not one of the 2 slots/],
    [{ answers: [{ slot: '1', pick: 'left' }] }, /slot/],
    [{ answers: [null] }, /slot/],
    [{ answers: [{ slot: 1, pick: 'left' }, { slot: 1, pick: 'right' }] }, /more than once/],
  ])('rejects %j', (given, message) => {
    expect(() => parseAnswers(given, key)).toThrow(message)
  })
})

describe('skipOnError', () => {
  it('a pair whose shot throws is skipped and another is picked', async () => {
    const logs: string[] = []
    const check = skipOnError(async (p) => { if (p.model === 'm1') throw new Error('shot failed'); return false }, (l) => logs.push(l))
    const picked = await pickCalibration(synthetic(), check)
    expect(picked).toHaveLength(20)
    expect(picked.some((p) => p.model === 'm1')).toBe(false)
    expect(logs[0]).toMatch(/Skipping .* shot failed/)
  })
})
