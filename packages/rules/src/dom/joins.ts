import type { JoinBreak } from '../model'
import { offScreen } from './hidden'
import { type Pred, type Ref, type Style } from './types'

/** Arabic letters that never join to the letter after them: hamza, alef forms, dal, thal, reh, zain, waw, teh marbuta. */
const NO_LEFT_JOIN = new Set('ءآأؤإادذرزوة')
const ARABIC_LETTER = /[ء-يٮ-ۓۺ-ۼ]/
/** Replaced or line-breaking content between two text nodes means they are not one word. */
const BREAKING = 'br,wbr,img,svg,video,canvas,input,button,select,textarea,iframe,object'
const ATOMIC: Record<string, JoinBreak['reason']> = { 'inline-block': 'inline-block', 'inline-flex': 'other' }

const endsJoining = (s: string): boolean => {
  const ch = s.at(-1) ?? ''
  return ARABIC_LETTER.test(ch) && !NO_LEFT_JOIN.has(ch)
}
const startsJoining = (s: string): boolean => {
  const ch = s[0] ?? ''
  return ARABIC_LETTER.test(ch) && ch !== 'ء'
}

/** The nearest ancestor of the node, below the common ancestor, that is an atomic inline box (it shapes its text on its own). */
function atomicAbove(node: Node, common: Node | null, style: Style): { el: Element; reason: JoinBreak['reason'] } | null {
  for (let el = node.parentElement; el && el !== common; el = el.parentElement) {
    const reason = ATOMIC[style(el).display]
    if (reason) return { el, reason }
  }
  return null
}

/**
 * Words that Chromium cannot join because an inline-block or inline-flex box splits them. Measured in verify.test.ts:
 * a colour span, `<b>`, a font-family change and padding leave the join intact, so they are not reported.
 * Only adjacent text nodes in different parents are looked at, where one ends and the next starts with a joining letter.
 */
export function readJoins(doc: Document, style: Style, skipped: Pred, ref: Ref): JoinBreak[] {
  const out: JoinBreak[] = []
  const seen = new Set<Element>()
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  let prev: Text | null = null
  for (let n = walker.nextNode() as Text | null; n; prev = n, n = walker.nextNode() as Text | null) {
    const text = n.data
    if (!prev || prev.parentElement === n.parentElement || !text) continue
    const before = prev.data
    if (!before || !endsJoining(before) || !startsJoining(text)) continue
    const a = prev.parentElement
    const b = n.parentElement
    if (!a || !b || skipped(a) || skipped(b)) continue
    const between = doc.createRange()
    between.setStart(prev, before.length)
    between.setEnd(n, 0)
    const gap = between.cloneContents()
    if (gap.textContent !== '' || gap.querySelector(BREAKING)) continue
    if (offScreen(a, style(a)) || offScreen(b, style(b))) continue
    const common = between.commonAncestorContainer
    const hit = atomicAbove(n, common, style) ?? atomicAbove(prev, common, style)
    if (!hit || seen.has(hit.el)) continue
    seen.add(hit.el)
    const word = (before.match(/\S+$/)?.[0] ?? '') + (text.match(/^\S+/)?.[0] ?? '')
    out.push({ ...ref(hit.el), reason: hit.reason, word })
  }
  return out
}
