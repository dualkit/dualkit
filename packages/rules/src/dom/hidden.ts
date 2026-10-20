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
