import type { ClipNode } from '../model'
import { hasArabic } from '../text'
import { clean, type Pred, type Ref, type Style } from './types'

const CLIPS = /^(hidden|clip)$/
const MIN_GAP = 1

type Box = { left: number; top: number; right: number; bottom: number }

/** True when the painted rect overlaps the box. A rect wholly outside, such as an off-screen carousel slide, does not. */
const overlaps = (r: DOMRect, b: Box): boolean => r.right > b.left && r.left < b.right && r.bottom > b.top && r.top < b.bottom

/**
 * How far the text under the element (its own and its descendants') paints past the element's padding box, per axis.
 * Only text runs at least partly inside the box count; a run painted wholly outside it is not cut off, it is elsewhere.
 */
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
    if (!parent || parent.closest('svg, script, style') || !own || nestedClip(parent, el, style) || inTrack(parent, el, style)) continue
    const range = el.ownerDocument.createRange()
    range.selectNodeContents(node)
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 || r.height > 0)
    if (!rects.some((r) => overlaps(r, { left, top, right, bottom }))) continue
    texts.push(own)
    for (const r of rects) {
      x = Math.max(x, r.right - right, left - r.left)
      y = Math.max(y, r.bottom - bottom, top - r.top)
    }
  }
  return { x, y, text: texts.join(' ') }
}

/** -webkit-line-clamp (Tailwind line-clamp-2) draws its own ellipsis on the last line it keeps, so it counts as one. */
const lineClamped = (s: CSSStyleDeclaration): boolean => {
  const clamp = s.getPropertyValue('-webkit-line-clamp').trim()
  return clamp !== '' && clamp !== 'none'
}

/**
 * True when the element moves what it draws by a translate, through `translate` or a `transform` whose linear part is
 * the identity (translate3d(0,0,0), as Swiper and Embla leave a track at rest, counts too).
 */
function translates(s: CSSStyleDeclaration): boolean {
  if (s.translate && s.translate !== 'none') return true
  if (!s.transform || s.transform === 'none') return false
  try {
    const m = new DOMMatrix(s.transform)
    return m.e !== 0 || m.f !== 0 || (m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1)
  } catch {
    return false
  }
}

/**
 * True when the text sits in a track moved by a translate inside the clip box: a carousel or odometer mask. The clip
 * box's own translate (a hover lift, Tailwind v3 `transform`) moves the mask with the text, so it does not count.
 */
function inTrack(from: Element, root: Element, style: Style): boolean {
  for (let n: Element | null = from; n && n !== root; n = n.parentElement) if (translates(style(n))) return true
  return false
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
    const base = { ellipsis: s.textOverflow === 'ellipsis' || lineClamped(s), hasArabic: hasArabic(reach.text) }
    // A box also scrolls for an oversized image or track, which cuts no text. Both the scroll size and the box's own text must overflow.
    const gapX = Math.min(el.scrollWidth - el.clientWidth, reach.x)
    const gapY = Math.min(el.scrollHeight - el.clientHeight, reach.y)
    if (x && gapX > MIN_GAP) out.push({ ...ref(el), axis: 'x', hidden: gapX, ...base })
    if (y && gapY > MIN_GAP) out.push({ ...ref(el), axis: 'y', hidden: gapY, ...base })
  }
  return out
}
