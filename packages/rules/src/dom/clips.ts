import type { ClipNode } from '../model'
import { hasArabic } from '../text'
import { clean, type Pred, type Ref, type Style } from './types'

const CLIPS = /^(hidden|clip)$/
const MIN_GAP = 1

/** How far the text under the element (its own and its descendants') paints past the element's padding box, per axis. */
function textReach(el: HTMLElement, style: Style): { x: number; y: number; text: string } {
  const box = el.getBoundingClientRect()
  const left = box.left + el.clientLeft
  const top = box.top + el.clientTop
  const right = left + el.clientWidth
  const bottom = top + el.clientHeight
  let x = 0
  let y = 0
  const texts: string[] = []
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement
    const own = clean(node.textContent ?? '')
    if (!parent || parent.closest('svg, script, style') || !own || nestedClip(parent, el, style)) continue
    texts.push(own)
    const range = el.ownerDocument.createRange()
    range.selectNodeContents(node)
    for (const r of Array.from(range.getClientRects())) {
      if (r.width === 0 && r.height === 0) continue
      x = Math.max(x, r.right - right, left - r.left)
      y = Math.max(y, r.bottom - bottom, top - r.top)
    }
  }
  return { x, y, text: texts.join(' ') }
}

/** True when a box between the text and the root clips on its own, so the text is that box's to report. */
function nestedClip(from: Element, root: Element, style: Style): boolean {
  for (let n: Element | null = from; n && n !== root; n = n.parentElement) {
    const s = style(n)
    if (CLIPS.test(s.overflowX) || CLIPS.test(s.overflowY)) return true
  }
  return false
}

/** Elements whose overflow:hidden or clip cuts their text off, own or in descendants that do not clip on their own. */
export function readClips(
  doc: Document, style: Style, skipped: Pred, visible: Pred, ref: Ref,
  hiddenFromView: (el: Element, s: CSSStyleDeclaration) => boolean,
): ClipNode[] {
  const out: ClipNode[] = []
  for (const el of Array.from(doc.body.querySelectorAll<HTMLElement>('*'))) {
    const s = style(el)
    const x = CLIPS.test(s.overflowX)
    const y = CLIPS.test(s.overflowY)
    if (!x && !y) continue
    if (el.closest('svg') || skipped(el) || !visible(el)) continue
    const reach = textReach(el, style)
    if (!reach.text) continue
    // A visually hidden box (or one inside one) is cut off on purpose.
    let hide = false
    for (let n: Element | null = el; n && n !== doc.body && !hide; n = n.parentElement) hide = hiddenFromView(n, style(n))
    if (hide) continue
    const base = { ellipsis: s.textOverflow === 'ellipsis', hasArabic: hasArabic(reach.text) }
    // A box also scrolls for an oversized image or track, which cuts no text. Both the scroll size and the box's own text must overflow.
    const gapX = Math.min(el.scrollWidth - el.clientWidth, reach.x)
    const gapY = Math.min(el.scrollHeight - el.clientHeight, reach.y)
    if (x && gapX > MIN_GAP) out.push({ ...ref(el), axis: 'x', hidden: gapX, ...base })
    if (y && gapY > MIN_GAP) out.push({ ...ref(el), axis: 'y', hidden: gapY, ...base })
  }
  return out
}
