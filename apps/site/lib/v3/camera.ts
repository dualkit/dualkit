export type Rect = { x: number; y: number; w: number; h: number }
export type Camera = { scale: number; x: number; y: number }
export type FrameOptions = {
  /** What must stay in view; defaults to the target. The target is centred, the bounds are clamped inside. */
  bounds?: Rect
  /** Margin kept clear inside `safe`, per axis or uniform. */
  inset?: number | { x: number; y: number }
}

const clamp = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)))

/**
 * Dolly towards a target but frame a box: zoom as far as maxZoom allows while the bounds still fit the
 * inset safe rect, centre the target, then clamp so nothing leaves the safe rect. The camera maps a
 * local point p to x + p * scale.
 */
export function frameCamera(target: Rect, safe: Rect, maxZoom: number, { bounds = target, inset = 32 }: FrameOptions = {}): Camera {
  const ix = typeof inset === 'number' ? inset : inset.x
  const iy = typeof inset === 'number' ? inset : inset.y
  const x0 = safe.x + ix, y0 = safe.y + iy, x1 = safe.x + safe.w - ix, y1 = safe.y + safe.h - iy
  const fit = Math.min((x1 - x0) / bounds.w, (y1 - y0) / bounds.h)
  const scale = Math.min(maxZoom, fit)
  const x = clamp((x0 + x1) / 2 - scale * (target.x + target.w / 2), x0 - scale * bounds.x, x1 - scale * (bounds.x + bounds.w))
  const y = clamp((y0 + y1) / 2 - scale * (target.y + target.h / 2), y0 - scale * bounds.y, y1 - scale * (bounds.y + bounds.h))
  return { scale, x, y }
}

/** How far the bounds could zoom inside a safe rect; the camera picks the region that allows the most. */
export function fitScale(bounds: Rect, safe: Rect, inset: number | { x: number; y: number } = 32): number {
  const ix = typeof inset === 'number' ? inset : inset.x
  const iy = typeof inset === 'number' ? inset : inset.y
  return Math.min((safe.w - 2 * ix) / bounds.w, (safe.h - 2 * iy) / bounds.h)
}
