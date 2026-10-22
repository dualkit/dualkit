import { describe, expect, it } from 'vitest'
import { findingsFrom, lineOf } from '../../src/review/position'
import { REVIEW_RULES } from '../../src/review/rules'

const ref = (id: string, snippet = `<p>${id}</p>`) => ({ id, snippet, box: { x: 0, y: 0, width: 1, height: 1 } })
const cands = [ref('a'), ref('b'), ref('c')]
const rules = REVIEW_RULES
const date = 'review/date-reads-wrong'

describe('findingsFrom', () => {
  it('maps element 2 to the third candidate as a review warning', () => {
    const [f] = findingsFrom(JSON.stringify({ findings: [{ rule: date, element: 2, message: 'Day and month are swapped.', confidence: 0.8 }] }), cands, rules)
    if (!f) throw new Error('no finding')
    expect(f).toMatchObject({ rule: date, severity: 'warning', source: 'review', confidence: 0.8, message: 'Day and month are swapped.', line: null })
    expect(f.node?.id).toBe('c')
    expect(f.docs).toContain('#review')
    expect(f.group).toBe(rules.find((r) => r.id === date)!.group)
    expect(f.fix).toBeTruthy()
    expect(f.title).toBeTruthy()
  })

  it('drops an element out of range, an unknown rule and a missing message', () => {
    const reply = JSON.stringify({ findings: [
      { rule: date, element: 999, message: 'x', confidence: 1 },
      { rule: date, element: -1, message: 'x', confidence: 1 },
      { rule: 'review/made-up', element: 0, message: 'x', confidence: 1 },
      { rule: date, element: 0, confidence: 1 },
      { rule: date, element: 0, message: '  ', confidence: 1 },
    ] })
    expect(findingsFrom(reply, cands, rules)).toEqual([])
  })

  it('clamps confidence to 0 to 1', () => {
    const reply = JSON.stringify({ findings: [{ rule: date, element: 0, message: 'a', confidence: 7 }, { rule: date, element: 1, message: 'b', confidence: -2 }] })
    expect(findingsFrom(reply, cands, rules).map((f) => f.confidence)).toEqual([1, 0])
  })

  it('returns [] for a reply that is not JSON or has the wrong shape', () => {
    expect(findingsFrom('sorry', cands, rules)).toEqual([])
    expect(findingsFrom('{"findings": 3}', cands, rules)).toEqual([])
    expect(findingsFrom('null', cands, rules)).toEqual([])
  })

  const good = JSON.stringify({ findings: [{ rule: date, element: 1, message: 'm', confidence: 0.5 }] })
  it('reads a fenced block with text before it', () => {
    expect(findingsFrom('Here is what I found:\n```json\n' + good + '\n```', cands, rules)).toHaveLength(1)
  })
  it('reads a fenced block with text after it', () => {
    expect(findingsFrom('```\n' + good + '\n```\nHope that helps.', cands, rules)).toHaveLength(1)
  })
  it('reads JSON with prose around it and no fence', () => {
    expect(findingsFrom('Sure. ' + good + ' Let me know.', cands, rules)).toHaveLength(1)
  })
  it('accepts element as a numeric string, counted from 0 like the prompt', () => {
    const reply = JSON.stringify({ findings: [{ rule: date, element: '2', message: 'm', confidence: 1 }, { rule: date, element: 'two', message: 'm', confidence: 1 }, { rule: date, element: '3', message: 'm', confidence: 1 }] })
    const out = findingsFrom(reply, cands, rules)
    expect(out).toHaveLength(1)
    expect(out[0]?.node?.id).toBe('c')
  })
  it('reads JSON inside a code fence', () => {
    const reply = '```json\n' + JSON.stringify({ findings: [{ rule: date, element: 1, message: 'm', confidence: 0.5 }] }) + '\n```'
    expect(findingsFrom(reply, cands, rules)).toHaveLength(1)
  })
})

describe('lineOf', () => {
  const src = '<main>\n  <h1>Hi</h1>\n  <p class="a" id="x">one</p>\n  <p class="b">two</p>\n  <p class="b">three</p>\n</main>'
  it('gives the 1-based line of a tag that occurs once', () => {
    expect(lineOf(src, ref('x', '<p class="a" id="x">one</p>'))).toBe(3)
  })
  it('ignores attribute order and whitespace', () => {
    expect(lineOf(src, ref('x', '<p   id="x"  class="a">one</p>'))).toBe(3)
  })
  it('returns null for a tag that appears twice or not at all', () => {
    expect(lineOf(src, ref('b', '<p class="b">two</p>'))).toBeNull()
    expect(lineOf(src, ref('z', '<section>'))).toBeNull()
  })
  it('matches a snippet cut in the middle of the opening tag', () => {
    expect(lineOf(src, ref('x', '<p class="a" id="x'))).toBe(3)
  })
})
