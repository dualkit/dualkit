import { describe, expect, it } from 'vitest'
import { buildAsk } from '../../src/review/prompt'
import { REVIEW_RULES } from '../../src/review/rules'
import { finding } from '../helpers'

const cands = [
  { id: 'p', snippet: '<p>مرحبا</p>', box: { x: 1, y: 2, width: 30, height: 40 } },
  { id: 'q', snippet: '<p>السعر</p>', box: { x: 5, y: 6, width: 70, height: 80 } },
]

describe('buildAsk', () => {
  const ask = buildAsk({ tiles: ['AAA', 'BBB', 'CCC'], cands, rules: REVIEW_RULES.slice(0, 2), already: [finding()] })

  it('sends one png per tile', () => {
    expect(ask.images).toEqual([0, 1, 2].map((i) => ({ mime: 'image/png', base64: ['AAA', 'BBB', 'CCC'][i] })))
  })

  it('numbers every candidate with its box', () => {
    expect(ask.text).toContain('[0] <p>مرحبا</p>')
    expect(ask.text).toContain('x 1, y 2, 30 by 40')
    expect(ask.text).toContain('[1] <p>السعر</p>')
  })

  it('lists the rule ids, the findings already reported and the do-not-repeat instruction', () => {
    for (const r of REVIEW_RULES.slice(0, 2)) expect(ask.text).toContain(r.id)
    expect(ask.text).toContain('bidi/unisolated-number')
    expect(ask.text).toMatch(/do not repeat/i)
  })

  it('states the reply shape', () => {
    expect(ask.text).toContain('{ "findings": [{ "rule"')
    expect(ask.text).toContain('"element"')
    expect(ask.text).toContain('"confidence"')
    expect(ask.system.length).toBeGreaterThan(0)
  })
})
