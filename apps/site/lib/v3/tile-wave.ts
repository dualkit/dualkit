/** Time between one diagonal of tiles and the next. */
export const TILE_STEP_MS = 175

/** Delay in ms for tile `index` on a grid `columns` wide: (column + row) diagonals of TILE_STEP_MS. */
export function tileDelay(index: number, columns: number): number {
  if (!Number.isInteger(index) || index < 0) throw new RangeError('index must be a non-negative integer')
  if (!Number.isInteger(columns) || columns < 1) throw new RangeError('columns must be a positive integer')
  return ((index % columns) + Math.floor(index / columns)) * TILE_STEP_MS
}

export function tileDelays(count: number, columns: number): number[] {
  return Array.from({ length: count }, (_, i) => tileDelay(i, columns))
}
