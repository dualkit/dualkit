const HIDDEN_CLIP_PATH = /^inset\(\s*(50%|100%|0(px)?\s+0(px)?\s+100%)/
const CLIPPED = /^rect\(\s*(0|1)(px)?[\s,)]/

/** The standard visually-hidden pattern: a 1px box, or a clip that leaves nothing showing. */
export function screenReaderOnly(el: Element, s: CSSStyleDeclaration): boolean {
  const r = el.getBoundingClientRect()
  if (r.width <= 1 && r.height <= 1) return true
  return CLIPPED.test(s.clip) || HIDDEN_CLIP_PATH.test(s.clipPath)
}

/** Not on screen for a sighted reader: display none, visibility hidden or the screen-reader-only pattern. aria-hidden alone still paints, so it does not count. */
export function offScreen(el: Element, s: CSSStyleDeclaration): boolean {
  return s.display === 'none' || s.visibility === 'hidden' || screenReaderOnly(el, s)
}

/** The element, or an ancestor up to and including the root, is off screen. */
export function offScreenWithin(el: Element, root: Element): boolean {
  const win = el.ownerDocument.defaultView!
  for (let n: Element | null = el; n; n = n.parentElement) {
    if (offScreen(n, win.getComputedStyle(n))) return true
    if (n === root) break
  }
  return false
}

type Range = { left: number; right: number }

const intersect = (a: Range, b: Range): Range => ({ left: Math.max(a.left, b.left), right: Math.min(a.right, b.right) })
const empty = (r: Range): boolean => r.right <= r.left
const clipsX = (s: CSSStyleDeclaration): boolean => s.overflowX !== 'visible' && s.display !== 'contents'
const isPositioned = (s: CSSStyleDeclaration): boolean => s.position !== 'static' || s.transform !== 'none'

/**
 * Builds a check for elements a reader never sees because they sit outside the viewport's horizontal range or outside
 * an ancestor that clips overflow (off-canvas menus, inactive carousel slides). Results are cached per element, so a
 * page costs one box read and one style read per element.
 */
export function makeClippedAway(): (el: Element) => boolean {
  const childRanges = new Map<Element, Range>()
  const visibleThrough = new Map<Element, boolean>()

  /** The range this element's own box has to fall in: its parent's, or for positioned elements its containing block's. */
  const incoming = (el: Element, position: string): Range => {
    const doc = el.ownerDocument
    const viewport = { left: 0, right: doc.documentElement.clientWidth }
    if (position === 'fixed') return viewport
    if (position === 'absolute') {
      const win = doc.defaultView!
      for (let n = el.parentElement; n; n = n.parentElement) {
        if (isPositioned(win.getComputedStyle(n))) return rangeWithin(n)
      }
      return viewport
    }
    return el.parentElement ? rangeWithin(el.parentElement) : viewport
  }

  /** The horizontal range a child of this element can show in. */
  const rangeWithin = (el: Element): Range => {
    const known = childRanges.get(el)
    if (known) return known
    const s = el.ownerDocument.defaultView!.getComputedStyle(el)
    let range = incoming(el, s.position)
    if (el.parentElement && clipsX(s)) {
      const r = el.getBoundingClientRect()
      const left = r.left + el.clientLeft
      range = intersect(range, { left, right: left + (el.clientWidth || r.width) })
    }
    childRanges.set(el, range)
    return range
  }

  return (el) => {
    const known = visibleThrough.get(el)
    if (known !== undefined) return known
    const s = el.ownerDocument.defaultView!.getComputedStyle(el)
    const r = el.getBoundingClientRect()
    const allowed = incoming(el, s.position)
    const result = empty(intersect({ left: r.left, right: r.right }, allowed))
    visibleThrough.set(el, result)
    return result
  }
}

/** True when the element's box, cut to the viewport and to every ancestor that clips overflow, has no width left. */
export const clippedAway = (el: Element): boolean => makeClippedAway()(el)
