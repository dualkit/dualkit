import { describe, expect, it } from 'vitest'
import { formatDate, verdict } from '../src/report/format'

describe('verdict', () => {
  it('names only the severities that are present', () => {
    expect(verdict(0, 1)).toEqual({ lead: '1 problem an Arabic reader will notice.', detail: '1 makes it feel translated.' })
    expect(verdict(2, 0)).toEqual({ lead: '2 problems an Arabic reader will notice.', detail: '2 break the screen.' })
    expect(verdict(0, 0)).toEqual({ lead: 'No problems an Arabic reader will notice.', detail: '' })
  })
})

describe('formatDate', () => {
  it('reads as day, short month and year, and survives a bad date', () => {
    expect(formatDate('2026-01-05T23:59:00.000Z')).toBe('5 Jan 2026')
    expect(formatDate('not a date')).toBe('not a date')
  })
})
