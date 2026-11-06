/** A small seeded generator (mulberry32), so the same seed always gives the same samples. Returns numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A seed for one layer, mixed from the run's seed and the layer's position, so each layer gets its own repeatable value. */
export function seedFor(seed: number, index: number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0
  h = Math.imul(h ^ (index + 1), 0x85ebca6b) >>> 0
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

export type Random = () => number

/** An integer in [min, max]. */
export const int = (rng: Random, min: number, max: number): number => min + Math.floor(rng() * (max - min + 1))

export const pickOne = <T>(rng: Random, items: readonly T[]): T => {
  const item = items[int(rng, 0, items.length - 1)]
  if (item === undefined) throw new RangeError('pickOne needs at least one item')
  return item
}

export const digits = (rng: Random, count: number): string => Array.from({ length: count }, () => String(int(rng, 0, 9))).join('')
