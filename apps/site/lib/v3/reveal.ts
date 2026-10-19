export const WORD_FLOOR = 0.18
/** Share of the scroll each word spends fading in; later words start later, so they finish later. */
export const WORD_SPAN = 0.2

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** Opacity of word `index` of `count` at section progress 0..1: 0.18 before its turn, 1 once read, linear between. */
export function wordOpacity(progress: number, index: number, count: number): number {
  if (count <= 1) return WORD_FLOOR + (1 - WORD_FLOOR) * clamp01(progress)
  const start = (index * (1 - WORD_SPAN)) / (count - 1)
  const local = clamp01((clamp01(progress) - start) / WORD_SPAN)
  return local >= 1 - 1e-9 ? 1 : WORD_FLOOR + (1 - WORD_FLOOR) * local
}

/** How far a tall track has scrolled past: 0 when its top meets the viewport top, 1 when the sticky child is about to leave. */
export function trackProgress(top: number, height: number, stickyHeight: number): number {
  const run = height - stickyHeight
  return run <= 0 ? 1 : clamp01(-top / run)
}
