import type { Style } from './types'

/** The element itself plus up to 4 ancestors. */
export const MIRROR_DEPTH = 5

/** The 2D linear part [a, b, c, d] of a transform; translation and transform-origin do not change whether it flips. */
export type Linear = [a: number, b: number, c: number, d: number]

const IDENTITY: Linear = [1, 0, 0, 1]
const AXES: Record<string, [number, number, number]> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }
const TURN_UNITS: Record<string, number> = { deg: 1, rad: 180 / Math.PI, grad: 0.9, turn: 360 }

const number = (token: string): number => (token.endsWith('%') ? parseFloat(token) / 100 : parseFloat(token))

function angleOf(token: string): number {
  const m = /^(-?[\d.]+(?:e-?\d+)?)(deg|rad|grad|turn)?$/i.exec(token)
  return m ? parseFloat(m[1]!) * (TURN_UNITS[(m[2] ?? 'deg').toLowerCase()] ?? 1) : NaN
}

/** The `rotate` property: an angle, or an axis (x, y, z or three numbers) and an angle. */
function withRotate(m: DOMMatrix, value: string): DOMMatrix {
  const tokens = value.trim().split(/\s+/)
  const angle = angleOf(tokens.at(-1) ?? '')
  if (!Number.isFinite(angle)) return m
  const axis = tokens.length === 2 ? AXES[tokens[0]!.toLowerCase()] : tokens.length === 4 ? (tokens.slice(0, 3).map(number) as [number, number, number]) : AXES.z
  return axis ? m.rotateAxisAngle(axis[0], axis[1], axis[2], angle) : m
}

/** The `scale` property: one value scales both axes, two scale x and y, a third scales z. */
function withScale(m: DOMMatrix, value: string): DOMMatrix {
  const [sx, sy, sz] = value.trim().split(/\s+/).map(number)
  if (sx === undefined || !Number.isFinite(sx)) return m
  return m.scale(sx, sy ?? sx, sz ?? 1)
}

/**
 * The 2D linear part of what the element applies through `rotate`, `scale` and `transform`, composed in that order
 * as CSS does (`translate` only moves it). Identity when nothing applies or a value cannot be read.
 */
export function linearOf(s: CSSStyleDeclaration): Linear {
  try {
    let m = new DOMMatrix()
    if (s.rotate && s.rotate !== 'none') m = withRotate(m, s.rotate)
    if (s.scale && s.scale !== 'none') m = withScale(m, s.scale)
    if (s.transform && s.transform !== 'none') m = m.multiply(new DOMMatrix(s.transform))
    return [m.a, m.b, m.c, m.d]
  } catch {
    return IDENTITY
  }
}

const det = ([a, b, c, d]: Linear): number => a * d - b * c

/** -1 when the element mirrors what it draws (the determinant a·d − b·c is negative), else 1. rotate(180deg) and scale(-1,-1) only turn it. */
export function flipSign(s: CSSStyleDeclaration): number {
  return det(linearOf(s)) < 0 ? -1 : 1
}

/** True when the element turns what it draws to point the other way without mirroring it, such as rotate(180deg) or scale(-1,-1). */
export function turns(s: CSSStyleDeclaration): boolean {
  const m = linearOf(s)
  return det(m) > 0 && m[0] < 0
}

/**
 * The nearest element that flips, when the flips over the element and up to 4 ancestors multiply to a mirror; else null.
 * A double flip reads as not mirrored. A run is not mirrored either when an element on its chain, up to and including
 * the farthest flip, has backface-visibility:hidden and the net transform at that element shows its back: Chromium
 * does not paint that face (the back of a flip card that has not turned, or the front of one that has).
 */
export function mirrorRoot(el: Element, style: Style): Element | null {
  const chain: { node: Element; sign: number; hidesBack: boolean }[] = []
  for (let node: Element | null = el, depth = 0; node && depth < MIRROR_DEPTH; depth++, node = node.parentElement) {
    const s = style(node)
    chain.push({ node, sign: flipSign(s), hidesBack: s.backfaceVisibility === 'hidden' })
  }
  const farthest = chain.findLastIndex((c) => c.sign < 0)
  if (farthest < 0) return null
  // net[i] is the sign of the transform at chain[i]: its own flip times every flip above it.
  const net = chain.map((_, i) => chain.slice(i).reduce((p, c) => p * c.sign, 1))
  if (chain.some((c, i) => i <= farthest && c.hidesBack && net[i]! < 0)) return null
  return net[0]! < 0 ? chain.find((c) => c.sign < 0)!.node : null
}
