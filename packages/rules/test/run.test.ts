import { describe, expect, it } from 'vitest'
import { defineRule, pick } from '../src/rule'
import { PER_RULE_CAP, WEIGHT, docsUrl, runRules, score } from '../src/run'
import { screen, text } from './helpers/model'

const always = (id: string, severity: 'error' | 'warning' | 'note', hits = 1) =>
  defineRule({ id, group: 'bidi', severity, title: id, why: 'w', fix: 'f', check: () => Array.from({ length: hits }, () => ({ node: null, message: 'm' })) })

describe('runRules', () => {
  it('turns hits into findings with the rule metadata and a docs link', () => {
    const [f] = runRules(screen(), { rules: [always('bidi/x', 'error')] })
    expect(f).toEqual({ rule: 'bidi/x', group: 'bidi', severity: 'error', title: 'bidi/x', message: 'm', fix: 'f', docs: docsUrl('bidi/x'), node: null })
  })

  it('skips ignored rules', () => {
    expect(runRules(screen(), { rules: [always('bidi/x', 'error')], ignore: ['bidi/x'] })).toEqual([])
  })

  it('sorts errors first, then by rule id', () => {
    const out = runRules(screen(), { rules: [always('b/note', 'note'), always('z/err', 'error'), always('a/err', 'error')] })
    expect(out.map((f) => f.rule)).toEqual(['a/err', 'z/err', 'b/note'])
  })
})

describe('score', () => {
  it('starts at 100 and caps how much one rule can cost', () => {
    expect(score([])).toBe(100)
    const many = runRules(screen(), { rules: [always('bidi/x', 'error', 10)] })
    expect(score(many)).toBe(100 - WEIGHT.error * PER_RULE_CAP)
  })

  it('never goes below zero', () => {
    const rules = Array.from({ length: 20 }, (_, i) => always(`r/${i}`, 'error', 3))
    expect(score(runRules(screen(), { rules }))).toBe(0)
  })
})

describe('helpers', () => {
  it('pick keeps only the node reference', () => {
    expect(Object.keys(pick(text()))).toEqual(['id', 'snippet', 'box'])
  })

  it('docsUrl points at the rule anchor in RULES.md', () => {
    expect(docsUrl('bidi/unisolated-number')).toBe('https://github.com/dualkit/dualkit/blob/main/packages/rules/RULES.md#bidi-unisolated-number')
  })
})
