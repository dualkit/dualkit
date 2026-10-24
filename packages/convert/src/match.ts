import { PNG } from 'pngjs'

/** A page passes the English match when under this share of its pixels differ. */
export const MAX_DIFF_RATIO = 0.001

/** A pixel differs when any RGBA channel differs by more than this. */
const CHANNEL_TOLERANCE = 8

const RED = [255, 0, 0, 255] as const

/** Compares two PNG screenshots. Returns the share of differing pixels and a PNG with those pixels in red. Sizes that differ count as fully different. */
export function compare(a: Buffer, b: Buffer): { ratio: number; diff: Buffer } {
  const left = PNG.sync.read(a)
  const right = PNG.sync.read(b)
  if (left.width !== right.width || left.height !== right.height) {
    const out = new PNG({ width: Math.max(left.width, right.width), height: Math.max(left.height, right.height) })
    for (let i = 0; i < out.data.length; i += 4) out.data.set(RED, i)
    return { ratio: 1, diff: PNG.sync.write(out) }
  }
  const out = new PNG({ width: left.width, height: left.height })
  let differing = 0
  for (let i = 0; i < left.data.length; i += 4) {
    const differs = [0, 1, 2, 3].some((c) => Math.abs((left.data[i + c] ?? 0) - (right.data[i + c] ?? 0)) > CHANNEL_TOLERANCE)
    if (differs) {
      differing++
      out.data.set(RED, i)
    } else {
      out.data.set([left.data[i] ?? 0, left.data[i + 1] ?? 0, left.data[i + 2] ?? 0, 64], i)
    }
  }
  return { ratio: differing / (left.width * left.height), diff: PNG.sync.write(out) }
}
