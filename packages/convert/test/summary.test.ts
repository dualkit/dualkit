import { describe, expect, it } from 'vitest'
import { mergeSummary } from '../src/summary'
import type { ConvertSummary, Flag } from '../src/types'

const flag = (file: string, line: number): Flag => ({ file, line, kind: 'computed-class', message: 'm', suggestion: '' })
const summary = (edits: number, flags: Flag[]): ConvertSummary =>
  ({ branch: 'dualkit/bilingual', filesChanged: edits, edits, byKind: { tailwind: edits, css: 0, markup: 0, strings: 0, formats: 0, wiring: 0 }, changed: [], flags, strings: edits, skipped: [] })

describe('mergeSummary', () => {
  it('keeps earlier flags, drops duplicates and takes counts from the latest run', () => {
    const earlier = summary(9, [flag('a.tsx', 1), flag('b.tsx', 2)])
    const next = summary(3, [flag('b.tsx', 2), flag('c.tsx', 3)])
    const merged = mergeSummary(earlier, next)
    expect(merged.flags.map((f) => f.file)).toEqual(['b.tsx', 'c.tsx', 'a.tsx'])
    expect(merged.edits).toBe(3)
    expect(merged.filesChanged).toBe(3)
    expect(merged.byKind.tailwind).toBe(3)
  })

  it('returns the new summary when there is no earlier one', () => {
    const next = summary(2, [flag('a.tsx', 1)])
    expect(mergeSummary(null, next)).toEqual(next)
  })
})
