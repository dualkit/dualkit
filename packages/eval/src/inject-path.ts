const ARGS: Readonly<Record<string, number>> = { m: 2, l: 2, t: 2, h: 1, v: 1, c: 6, s: 4, q: 4, a: 7, z: 0 }
const TOKEN = /([a-zA-Z])|(-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/g

const fmt = (n: number) => String(Math.round(n * 1e4) / 1e4)

/** Mirror one x value across the box axis; relative values just change sign. */
function mirrorX(x: number, relative: boolean, axis: number): number {
  return relative ? -x : axis - x
}

/** Mirror an SVG path left to right. Null when the path uses something this does not read. */
export function mirrorPath(d: string, minX: number, width: number): string | null {
  const axis = 2 * minX + width
  const tokens = [...d.matchAll(TOKEN)]
  const out: string[] = []
  let i = 0
  while (i < tokens.length) {
    const cmd = tokens[i]![1]
    if (cmd === undefined) return null
    const lower = cmd.toLowerCase()
    const size = ARGS[lower]
    if (size === undefined) return null
    const relative = cmd === lower
    i++
    out.push(cmd)
    if (size === 0) continue
    let first = true
    // A command may repeat its arguments without repeating the letter.
    while (i < tokens.length && tokens[i]![2] !== undefined) {
      const args = tokens.slice(i, i + size).map((t) => (t[2] === undefined ? NaN : Number(t[2])))
      if (args.length < size || args.some(Number.isNaN)) return null
      i += size
      const mirrored = args.map((n, k) => mirrorArg(lower, k, n, relative, axis))
      out.push(...mirrored.map(fmt))
      first = false
    }
    if (first) return null
  }
  return out.join(' ')
}

function mirrorArg(cmd: string, k: number, n: number, relative: boolean, axis: number): number {
  if (cmd === 'a') {
    if (k === 2) return -n
    if (k === 4) return 1 - n
    return k === 5 ? mirrorX(n, relative, axis) : n
  }
  if (cmd === 'v') return n
  if (cmd === 'h') return mirrorX(n, relative, axis)
  return k % 2 === 0 ? mirrorX(n, relative, axis) : n
}

/** Mirror a polyline points list. */
export function mirrorPoints(points: string, minX: number, width: number): string | null {
  const nums = points.trim().split(/[\s,]+/).map(Number)
  if (nums.length < 4 || nums.length % 2 !== 0 || nums.some(Number.isNaN)) return null
  return nums.map((n, k) => fmt(k % 2 === 0 ? 2 * minX + width - n : n)).join(' ')
}
