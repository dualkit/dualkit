import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { toHijri } from '../src/index'

// Month starts from the official KACST Umm al-Qura service; see docs/research/2026-11-06-hijri-audit.md.
type Table = { readonly starts: Readonly<Record<string, readonly string[]>> }
const table: Table = JSON.parse(
  readFileSync(new URL('./fixtures/umm-al-qura-month-starts.json', import.meta.url), 'utf8'),
)

const RIYADH = { timeZone: 'Asia/Riyadh' } as const
const FIRST_YEAR = 1440
const LAST_YEAR = 1470

const cases = Object.entries(table.starts).flatMap(([year, starts]) =>
  starts.map((start, index) => ({ year: Number(year), month: index + 1, start })),
)

describe('toHijri against the official Umm al-Qura month starts', () => {
  it(`covers every month from ${FIRST_YEAR} to ${LAST_YEAR} AH`, () => {
    expect(cases).toHaveLength((LAST_YEAR - FIRST_YEAR + 1) * 12)
  })

  it.each(cases)('$year-$month starts on $start in Riyadh', ({ year, month, start }) => {
    expect(toHijri(new Date(`${start}T00:00:00+03:00`), RIYADH)).toEqual({ year, month, day: 1 })
    expect(toHijri(new Date(`${start}T23:59:59+03:00`), RIYADH)).toEqual({ year, month, day: 1 })
  })
})
