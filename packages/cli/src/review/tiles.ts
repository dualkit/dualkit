import { PNG } from 'pngjs'

/** The height the audit screenshot is taken at, in CSS px. One tile is one viewport tall. */
export const VIEWPORT_HEIGHT = 800

/** Cuts a base64 PNG into viewport-high base64 PNG slices. A taller page keeps its first `maxTiles` slices. */
export function tiles(png: string, scale: number, maxTiles = 4): string[] {
  const src = PNG.sync.read(Buffer.from(png, 'base64'))
  const step = Math.max(1, Math.round(VIEWPORT_HEIGHT * scale))
  const count = Math.min(maxTiles, Math.max(1, Math.ceil(src.height / step)))
  return Array.from({ length: count }, (_, i) => {
    const top = i * step
    const height = Math.min(step, src.height - top)
    const out = new PNG({ width: src.width, height })
    PNG.bitblt(src, out, 0, top, src.width, height, 0, 0)
    return PNG.sync.write(out).toString('base64')
  })
}
