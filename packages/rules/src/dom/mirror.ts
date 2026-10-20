import type { Style } from './types'

export const MIRROR_DEPTH = 4

/** The sign of the horizontal scale an element applies through `transform` or `scale`: -1, or 1 when it does not flip. */
export function flipSign(s: CSSStyleDeclaration): number {
  let sign = 1
  const m = /matrix(?:3d)?\(([^)]+)\)/.exec(s.transform)
  if (m && parseFloat(m[1]!.split(',')[0]!) < 0) sign = -sign
  if (s.scale && s.scale !== 'none' && parseFloat(s.scale) < 0) sign = -sign
  return sign
}

/** The product of the flips over the element and up to 4 ancestors, so a double flip reads as not mirrored. */
export function netMirrored(el: Element, style: Style): boolean {
  let sign = 1
  let node: Element | null = el
  for (let depth = 0; node && depth < MIRROR_DEPTH; depth++, node = node.parentElement) sign *= flipSign(style(node))
  return sign < 0
}
