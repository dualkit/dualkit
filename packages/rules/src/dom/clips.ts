import type { ClipNode } from '../model'
import { hasArabic } from '../text'
import { clean, type Pred, type Ref, type Style } from './types'

const CLIPS = /^(hidden|clip)$/
const MIN_GAP = 1

/** Elements with their own text whose overflow:hidden or clip cuts something off. */
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
    const ownText = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => clean(n.textContent ?? '')).join(' ').trim()
    if (!ownText) continue
    // A visually hidden box (or one inside one) is cut off on purpose.
    let hide = false
    for (let n: Element | null = el; n && n !== doc.body && !hide; n = n.parentElement) hide = hiddenFromView(n, style(n))
    if (hide) continue
    const base = { ellipsis: s.textOverflow === 'ellipsis', hasArabic: hasArabic(ownText) }
    const gapX = el.scrollWidth - el.clientWidth
    const gapY = el.scrollHeight - el.clientHeight
    if (x && gapX > MIN_GAP) out.push({ ...ref(el), axis: 'x', hidden: gapX, ...base })
    if (y && gapY > MIN_GAP) out.push({ ...ref(el), axis: 'y', hidden: gapY, ...base })
  }
  return out
}
