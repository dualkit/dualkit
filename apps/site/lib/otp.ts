import { toWesternDigits } from '@dualkit/format'

/** Reads a verification code typed one digit per cell, in any digit system. A blank or a non-digit shows as a space. */
export function readCode(cells: readonly string[]): { complete: boolean; value: string } {
  const digits = cells.map((c) => {
    const d = toWesternDigits(c.trim()).slice(-1)
    return /^\d$/.test(d) ? d : ' '
  })
  return { complete: digits.every((d) => d !== ' '), value: digits.join('') }
}
