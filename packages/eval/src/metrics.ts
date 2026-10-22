import type { Tally } from './types.js'

/** Real findings over decided findings. Unclear ones are left out. Null when nothing is decided. */
export function precision(t: Tally): number | null {
  const decided = t.real + t.handled + t.intended
  return decided === 0 ? null : t.real / decided
}

/** Share of known bugs caught. Null when there are none. */
export function recall(caught: number, total: number): number | null {
  return total === 0 ? null : caught / total
}

/** Harmonic mean of precision and recall. Null when either is null. */
export function f1(p: number | null, r: number | null): number | null {
  if (p === null || r === null) return null
  return p + r === 0 ? 0 : (2 * p * r) / (p + r)
}
