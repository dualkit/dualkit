import type { Style } from './types'

/** The element itself plus up to 4 ancestors. */
export const MIRROR_DEPTH = 5

/** The sign of the horizontal scale an element applies through `transform` or `scale`: -1, or 1 when it does not flip. */
export function flipSign(s: CSSStyleDeclaration): number {
  let sign = 1
  const m = /matrix(?:3d)?\(([^)]+)\)/.exec(s.transform)
  if (m && parseFloat(m[1]!.split(',')[0]!) < 0) sign = -sign
  if (s.scale && s.scale !== 'none' && parseFloat(s.scale) < 0) sign = -sign
  return sign
}

/** The nearest element that flips, when the flips over the element and up to 4 ancestors multiply to a mirror; else null. A double flip reads as not mirrored. */
export function mirrorRoot(el: Element, style: Style): Element | null {
  let sign = 1
  let nearest: Element | null = null
  let node: Element | null = el
  for (let depth = 0; node && depth < MIRROR_DEPTH; depth++, node = node.parentElement) {
    const s = flipSign(style(node))
    if (s < 0 && !nearest) nearest = node
    sign *= s
  }
  return sign < 0 ? nearest : null
}
