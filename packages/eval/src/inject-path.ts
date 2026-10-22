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
    // A leading moveto is measured from the origin, so its first pair is absolute.
    let absoluteFirst = i === 1 && cmd === 'm'
    // A command may repeat its arguments without repeating the letter.
    while (i < tokens.length && tokens[i]![2] !== undefined) {
      const args = tokens.slice(i, i + size).map((t) => (t[2] === undefined ? NaN : Number(t[2])))
      if (args.length < size || args.some(Number.isNaN)) return null
      i += size
      const mirrored = args.map((n, k) => mirrorArg(lower, k, n, relative && !absoluteFirst, axis))
      absoluteFirst = false
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

export type Point = { readonly x: number; readonly y: number }

/** Absolute vertices of each subpath. Curves and arcs contribute their end points. */
export function pathVertices(d: string): readonly (readonly Point[])[] {
  const tokens = [...d.matchAll(TOKEN)]
  const subpaths: Point[][] = []
  let cur: Point = { x: 0, y: 0 }
  let start = cur
  let i = 0
  const push = (p: Point) => {
    cur = p
    subpaths[subpaths.length - 1]?.push(p)
  }
  while (i < tokens.length) {
    const cmd = tokens[i]![1]
    const size = cmd === undefined ? undefined : ARGS[cmd.toLowerCase()]
    if (cmd === undefined || size === undefined) return []
    const lower = cmd.toLowerCase()
    const rel = cmd === lower
    i++
    if (lower === 'z') {
      push(start)
      continue
    }
    let firstPair = true
    while (i < tokens.length && tokens[i]![2] !== undefined) {
      const a = tokens.slice(i, i + size).map((t) => Number(t[2]))
      if (a.length < size || a.some(Number.isNaN)) return []
      i += size
      const ox = rel ? cur.x : 0
      const oy = rel ? cur.y : 0
      if (lower === 'h') push({ x: ox + a[0]!, y: cur.y })
      else if (lower === 'v') push({ x: cur.x, y: oy + a[0]! })
      else {
        const end = { x: ox + a[size - 2]!, y: oy + a[size - 1]! }
        if (lower === 'm' && firstPair) {
          subpaths.push([])
          start = end
        }
        push(end)
      }
      firstPair = false
    }
  }
  return subpaths.filter((s) => s.length > 0)
}

export function pointVertices(points: string): readonly (readonly Point[])[] {
  const n = points.trim().split(/[\s,]+/).map(Number)
  const pts: Point[] = []
  for (let k = 0; k + 1 < n.length; k += 2) pts.push({ x: n[k]!, y: n[k + 1]! })
  return [pts]
}

/** Which way the arrow head points: the sharpest wide corner of any subpath. Null when no head is found. */
export function headDirection(subpaths: readonly (readonly Point[])[]): 'left' | 'right' | null {
  let best: { span: number; dir: 'left' | 'right' } | null = null
  for (const pts of subpaths) {
    for (let k = 1; k + 1 < pts.length; k++) {
      const [a, b, c] = [pts[k - 1]!, pts[k]!, pts[k + 1]!]
      const span = Math.abs(a.y - c.y)
      const opposite = (a.y - b.y) * (c.y - b.y) < 0
      const dir = a.x > b.x && c.x > b.x ? 'left' : a.x < b.x && c.x < b.x ? 'right' : null
      if (opposite && dir !== null && (best === null || span > best.span)) best = { span, dir }
    }
  }
  return best?.dir ?? null
}
