import { clean } from './types'

const px = (value: string): number => parseFloat(value) || 0

/** Content box width: the padding box for a block, the painted box for an inline element, less padding either way. */
function contentWidth(el: Element, s: CSSStyleDeclaration): number {
  const padding = px(s.paddingLeft) + px(s.paddingRight)
  const own = (el as HTMLElement).clientWidth
  return Math.max(0, (own > 0 ? own : el.getBoundingClientRect().width) - padding)
}

/** The widest line the element's own text paints, summing the pieces that share a line. */
function widestLine(el: Element): number {
  const doc = el.ownerDocument
  const lines = new Map<number, number>()
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType !== 3 || clean(node.textContent ?? '') === '') continue
    const range = doc.createRange()
    range.selectNodeContents(node)
    for (const r of Array.from(range.getClientRects())) {
      const line = Math.round(r.top)
      lines.set(line, (lines.get(line) ?? 0) + r.width)
    }
  }
  return Math.max(0, ...lines.values())
}

/** Room left beside the element's own text, in px: how far a text-align can move it. */
export function textSlackOf(el: Element, s: CSSStyleDeclaration): number {
  return Math.max(0, contentWidth(el, s) - widestLine(el))
}
