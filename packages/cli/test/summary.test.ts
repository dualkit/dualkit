import { describe, expect, it } from 'vitest'
import { formatSummary } from '../src/summary'
import { finding, result } from './helpers'

describe('formatSummary', () => {
  it('prints the score, counts and one line per rule without colour when asked', () => {
    const text = formatSummary(result([finding(), finding(), finding({ rule: 'type/arabic-size', severity: 'warning', title: 'Arabic set too small' })]), false)
    expect(text).toContain('Score 72/100')
    expect(text).toContain('1 rule with errors, 1 with warnings')
    expect(text).toContain('bidi/unisolated-number (2)')
    expect(text).not.toMatch(/\u001b\[/)
  })
  it('mentions unreadable stylesheets', () => {
    expect(formatSummary(result([], { unreadableStylesheets: 1 }), false)).toContain('1 stylesheet could not be read')
  })
  it('adds colour codes when asked', () => {
    expect(formatSummary(result([finding()]), true)).toMatch(/\u001b\[31m/)
  })
})
