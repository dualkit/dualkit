// Which city the Gulf map highlights, and how dark a dot gets near the pointer. Pure, so the tests cover them.

/** enter and focus pick a city; leave and blur let go only of the city they name; tap toggles (a phone has no hover). */
export type SelectEvent =
  | { type: 'enter' | 'focus' | 'tap'; city: string }
  | { type: 'leave' | 'blur'; city: string }
  | { type: 'clear' }

export function selectReducer(current: string | null, e: SelectEvent): string | null {
  switch (e.type) {
    case 'enter':
    case 'focus':
      return e.city
    case 'tap':
      return current === e.city ? null : e.city
    case 'leave':
    case 'blur':
      return current === e.city ? null : current
    case 'clear':
      return null
  }
}

/** Dots within this many css px of the pointer darken. */
export const NEAR_RADIUS = 60
export const PROXIMITY_ALPHA = 0.9

/** A dot's alpha at `distance` px from the pointer: its own alpha beyond the radius, up to PROXIMITY_ALPHA at the pointer, eased. */
export function proximityAlpha(base: number, distance: number, radius = NEAR_RADIUS, peak = PROXIMITY_ALPHA): number {
  if (!(distance < radius) || peak <= base) return base
  const k = 1 - distance / radius
  return base + (peak - base) * k * k
}

/** The arc from Dubai to a city, as a quadratic path lifted above the higher end (map px). Null for Dubai itself. */
export function arcPath(from: { x: number; y: number }, to: { x: number; y: number }, lift: number): string | null {
  if (Math.abs(from.x - to.x) < 0.5 && Math.abs(from.y - to.y) < 0.5) return null
  const r = (n: number) => Math.round(n * 10) / 10
  return `M${r(from.x)} ${r(from.y)}Q${r((from.x + to.x) / 2)} ${r(Math.min(from.y, to.y) - lift)} ${r(to.x)} ${r(to.y)}`
}
