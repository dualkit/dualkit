import { describe, expect, it } from 'vitest'
import type { Answer, Ask } from '../../../cli/src/review/model'
import type { Checklist } from './checklist.js'
import { buildJudgeAsk, decide, judgePair, parseVerdict, type CallVerdict, type Mark } from './judge.js'

const checklist: Checklist = { screen: 's', points: [{ id: 'p1', text: 'one' }, { id: 'p2', text: 'two' }, { id: 'p3', text: 'three' }] }
const ALONE = Buffer.from('alone-image')
const OTHER = Buffer.from('other-image')
const b64 = (b: Buffer) => b.toString('base64')

const verdict = (left: Mark[], right: Mark[], pick: 'left' | 'right' | 'same' = 'same'): CallVerdict => ({
  points: left.map((l, i) => ({ id: `p${i + 1}`, left: l, right: right[i] ?? 'na' })), pick,
})
const reply = (v: CallVerdict, costUsd = 0.01): Answer => ({ ok: true, text: JSON.stringify(v), costUsd })

/** A fake judge that prefers one condition, whichever side it lands on. */
const prefers = (who: 'alone' | 'other' | 'none', calls: Ask[] = []) => async (a: Ask): Promise<Answer> => {
  calls.push(a)
  const leftIsAlone = a.images[0]?.base64 === b64(ALONE)
  if (who === 'none') return reply(verdict(['pass', 'pass', 'pass'], ['pass', 'pass', 'pass'], 'same'))
  const leftWins = (who === 'alone') === leftIsAlone
  return leftWins
    ? reply(verdict(['pass', 'pass', 'pass'], ['fail', 'fail', 'fail'], 'left'))
    : reply(verdict(['fail', 'fail', 'fail'], ['pass', 'pass', 'pass'], 'right'))
}

describe('decide', () => {
  it('points decide before the holistic pick', () => {
    expect(decide(verdict(['pass', 'pass', 'fail'], ['pass', 'fail', 'fail'], 'right'))).toBe('left')
  })
  it('the holistic pick breaks ties', () => {
    expect(decide(verdict(['pass', 'fail', 'na'], ['fail', 'pass', 'na'], 'right'))).toBe('right')
  })
})

describe('parseVerdict', () => {
  it('unknown ids are ignored and missing ids are na', () => {
    const text = JSON.stringify({ points: [{ id: 'p1', left: 'pass', right: 'fail' }, { id: 'p9', left: 'pass', right: 'pass' }], pick: 'left' })
    const v = parseVerdict(text, checklist)
    expect(v?.points).toEqual([
      { id: 'p1', left: 'pass', right: 'fail' },
      { id: 'p2', left: 'na', right: 'na' },
      { id: 'p3', left: 'na', right: 'na' },
    ])
  })
  it('rejects no json, a bad pick or a bad mark', () => {
    expect(parseVerdict('not json', checklist)).toBeNull()
    expect(parseVerdict('{"points":[],"pick":"both"}', checklist)).toBeNull()
    expect(parseVerdict('{"points":[{"id":"p1","left":"maybe","right":"pass"}],"pick":"left"}', checklist)).toBeNull()
  })
})

describe('judgePair', () => {
  it('a winner must hold both ways', async () => {
    const r = await judgePair({ checklist, alone: ALONE, other: OTHER, ask: prefers('other'), flip: false })
    expect(r).toMatchObject({ winner: 'dualkit', byDefault: false })
    expect((await judgePair({ checklist, alone: ALONE, other: OTHER, ask: prefers('none'), flip: false })).byDefault).toBe(false)
    expect(r.costUsd).toBeCloseTo(0.02)
    expect((await judgePair({ checklist, alone: ALONE, other: OTHER, ask: prefers('alone'), flip: true })).winner).toBe('alone')
  })
  it('always picking the first image is inconsistent', async () => {
    const ask = async (): Promise<Answer> => reply(verdict(['pass', 'pass', 'pass'], ['fail', 'fail', 'fail'], 'left'))
    expect((await judgePair({ checklist, alone: ALONE, other: OTHER, ask, flip: false })).winner).toBe('inconsistent')
  })
  it('two sames are a tie', async () => {
    expect((await judgePair({ checklist, alone: ALONE, other: OTHER, ask: prefers('none'), flip: false })).winner).toBe('tie')
  })
  it('malformed JSON fails the pair', async () => {
    let n = 0
    const ask = async (): Promise<Answer> => (n++ === 0 ? { ok: true, text: 'not json', costUsd: 0.01 } : reply(verdict(['pass'], ['fail'], 'left'), 0.02))
    const r = await judgePair({ checklist, alone: ALONE, other: OTHER, ask, flip: false })
    expect(r.winner).toBe('failed')
    expect(r.error).toBeTruthy()
    expect(r.costUsd).toBeCloseTo(0.03)
  })
  it('a failed call fails the pair', async () => {
    const ask = async (): Promise<Answer> => ({ ok: false, error: 'boom' })
    const r = await judgePair({ checklist, alone: ALONE, other: OTHER, ask, flip: false })
    expect(r).toMatchObject({ winner: 'failed', error: expect.stringContaining('boom') })
  })
  it('the second call swaps the images', async () => {
    const calls: Ask[] = []
    await judgePair({ checklist, alone: ALONE, other: OTHER, ask: prefers('none', calls), flip: false })
    expect(calls.map((c) => c.images.map((i) => i.base64))).toEqual([[b64(ALONE), b64(OTHER)], [b64(OTHER), b64(ALONE)]])
    const flipped: Ask[] = []
    await judgePair({ checklist, alone: ALONE, other: OTHER, ask: prefers('none', flipped), flip: true })
    expect(flipped[0]?.images[0]?.base64).toBe(b64(OTHER))
  })
})

describe('buildJudgeAsk', () => {
  it('the prompt is blind', () => {
    const a = buildJudgeAsk(checklist, ALONE, OTHER)
    expect(a.system).not.toMatch(/dualkit|alone|model|gemini|minimax/i)
    expect(a.text).not.toMatch(/dualkit|alone|model|gemini|minimax/i)
    expect(a.text).toContain('p2')
    expect(a.images).toHaveLength(2)
  })
})
