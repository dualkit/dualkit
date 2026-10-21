import { describe, expect, it } from 'vitest'
import type { LintFinding } from '@dualkit/lint'
import { feedbackPrompt, lintPage } from '../src/feedback'
import type { SlimFinding } from '../src/score'

const check = (o: Partial<SlimFinding> = {}): SlimFinding => ({ rule: 'layout/overflow', title: 'Content overflows', severity: 'warning', box: null, message: 'It spills.', fix: 'Use min-width: 0.', snippet: '<div class="a">', ...o })
const lint = (o: Partial<LintFinding> = {}): LintFinding => ({ rule: 'source/physical-css', group: 'source', docs: 'https://example.test', severity: 'warning', title: 'Physical property', message: 'Uses margin-left.', fix: 'Use margin-inline-start.', file: 'index.html', line: 3, column: 5, ...o })

describe('feedbackPrompt', () => {
  it('returns null when only notes are left', () => {
    expect(feedbackPrompt([check({ severity: 'note' })], [lint({ severity: 'note' })])).toBeNull()
  })
  it('numbers check before lint and ends with the instruction', () => {
    expect(feedbackPrompt([check()], [lint()])).toBe([
      'dualkit check and dualkit lint found these problems in your page.',
      '',
      '1. [check] Content overflows (layout/overflow): It spills. Element: `<div class="a">`. How to fix: Use min-width: 0.',
      '2. [lint] Physical property (source/physical-css), line 3: Uses margin-left. How to fix: Use margin-inline-start.',
      '',
      'Fix these. Change only what they need. Reply with the whole file.',
    ].join('\n'))
  })
  it('caps at 40 and says how many more', () => {
    const out = feedbackPrompt(Array.from({ length: 45 }, () => check()), [lint()])!
    expect(out).toContain('40. [check]')
    expect(out).not.toContain('41. ')
    expect(out).toContain('\n…and 6 more.\n\nFix these.')
  })
  it('lints a style block in the page', () => {
    // physical-css is a note, so the brief's margin-left example is filtered out; letter-spacing on Arabic is an error and proves the style block is read.
    const found = lintPage('<!doctype html><html lang="ar" dir="rtl"><head><style>:lang(ar) .a { letter-spacing: 2px; margin-left: 8px }</style></head><body></body></html>')
    expect(found.map((f) => f.rule)).toEqual(['source/arabic-letter-spacing'])
    expect(found.every((f) => f.severity !== 'note')).toBe(true)
  })
})
