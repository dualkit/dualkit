import { describe, expect, it } from 'vitest'
import { REVIEW_RULES, pickRules } from '../../src/review/rules'

describe('review rules', () => {
  it('has eight rules with plain, dash-free wording', () => {
    expect(REVIEW_RULES).toHaveLength(8)
    for (const r of REVIEW_RULES) {
      expect(r.id).toMatch(/^review\/[a-z-]+$/)
      expect(`${r.title}${r.ask}${r.fix}`).not.toMatch(/[—–]/)
    }
    expect(new Set(REVIEW_RULES.map((r) => r.id)).size).toBe(8)
  })

  it('picks rules by feature and always keeps the feature-free ones', () => {
    const ids = pickRules(['dates']).map((r) => r.id)
    expect(ids).toContain('review/date-reads-wrong')
    expect(ids).not.toContain('review/chat-bubble-side-wrong')
    expect(ids).toContain('review/arabic-reads-machine-translated')
    expect(pickRules([]).length).toBeGreaterThan(0)
  })
})
