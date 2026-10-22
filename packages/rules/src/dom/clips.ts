import type { ClipNode } from '../model'
import { hasArabic } from '../text'
import { clean, type Pred, type Ref, type Style } from './types'

const CLIPS = /^(hidden|clip)$/
const MIN_GAP = 1

type Box = { left: number; top: number; right: number; bottom: number }

/** True when the painted rect overlaps the box. A rect wholly outside, such as an off-screen carousel slide, does not. */
const overlaps = (r: DOMRect, b: Box): boolean => r.right > b.left && r.left < b.right && r.bottom > b.top && r.top < b.bottom

/** Px of the rect's span [a, b] that lies inside [lo, hi]. */
const inside = (a: number, b: number, lo: number, hi: number): number => Math.max(0, Math.min(b, hi) - Math.max(a, lo))

/**
 * One span per line of a text node: the union of its rects on that line. Chromium adds a second, overlapping rect for
 * the part an ellipsis keeps, so summing rects would count that part twice.
 */
function lineSpans(rects: DOMRect[]): Box[] {
  const lines = new Map<number, Box>()
  for (const r of rects) {
    const key = Math.round(r.top)
    const had = lines.get(key)
    lines.set(key, had
      ? { left: Math.min(had.left, r.left), right: Math.max(had.right, r.right), top: Math.min(had.top, r.top), bottom: Math.max(had.bottom, r.bottom) }
      : { left: r.left, right: r.right, top: r.top, bottom: r.bottom })
  }
  return [...lines.values()]
}

type Reach = { x: number; y: number; text: string; full: number; visible: number }

/**
 * How far the text under the element (its own and its descendants') paints past the element's padding box, which is
 * where overflow clips, per axis, and how much of its width is painted inside that box. On a line cut sideways, the
 * ellipsis is painted over the end of what fits, so its width does not count as shown text.
 * Only text runs at least partly inside the box count; a run painted wholly outside it is not cut off, it is elsewhere.
 */
function textReach(el: HTMLElement, style: Style, ellipsisWidth: number): Reach {
  const box = el.getBoundingClientRect()
  const left = box.left + el.clientLeft
  const top = box.top + el.clientTop
  const right = left + el.clientWidth
  const bottom = top + el.clientHeight
  let x = 0
  let y = 0
  let full = 0
  let visible = 0
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
    // A line counts as shown across the width it keeps inside the box, and as hidden when it sits wholly above or below.
    for (const line of lineSpans(rects)) {
      full += line.right - line.left
      const cut = line.left < left - MIN_GAP || line.right > right + MIN_GAP
      if (inside(line.top, line.bottom, top, bottom) > 0) visible += Math.max(0, inside(line.left, line.right, left, right) - (cut ? ellipsisWidth : 0))
    }
  }
  return { x, y, text: texts.join(' '), full, visible }
}

/** The width of the ellipsis the box paints in its own font, or 0 when it paints none at the line end. */
function ellipsisWidth(doc: Document, s: CSSStyleDeclaration): number {
  if (s.textOverflow !== 'ellipsis') return 0
  const ctx = doc.createElement('canvas').getContext('2d')
  if (!ctx) return 0
  ctx.font = s.font || `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`
  return ctx.measureText('\u2026').width
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
    const reach = textReach(el, style, ellipsisWidth(doc, s))
    if (!reach.text) continue
    // A visually hidden box (or one inside one) is cut off on purpose.
    let hide = false
    for (let n: Element | null = el; n && n !== doc.body && !hide; n = n.parentElement) hide = hiddenFromView(n, style(n))
    if (hide) continue
    const base = {
      ellipsis: s.textOverflow === 'ellipsis' || lineClamped(s),
      hasArabic: hasArabic(reach.text),
      visibleShare: reach.full > 0 ? Math.min(1, reach.visible / reach.full) : 1,
    }
    // A box also scrolls for an oversized image or track, which cuts no text. Both the scroll size and the box's own text must overflow.
    const scrollX = el.scrollWidth - el.clientWidth
    const scrollY = el.scrollHeight - el.clientHeight
    if (x && Math.min(scrollX, reach.x) > MIN_GAP) out.push({ ...ref(el), axis: 'x', hidden: scrollX, textHidden: reach.x, ...base })
    if (y && Math.min(scrollY, reach.y) > MIN_GAP) out.push({ ...ref(el), axis: 'y', hidden: scrollY, textHidden: reach.y, ...base })
  }
  return out
}
