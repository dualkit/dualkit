import type { JoinBreak } from '../model'
import { offScreen } from './hidden'
import { type Pred, type Ref, type Style } from './types'

/**
 * Arabic letters that never join to the letter after them: joining type U (hamza) and R (right-joining only) in
 * ArabicShaping.txt, over the Arabic, Arabic Supplement and Arabic Extended-A blocks.
 */
const NO_LEFT_JOIN = new RegExp(
  '[\\u0621\\u0622-\\u0625\\u0627\\u0629\\u062f-\\u0632\\u0648\\u0671-\\u0673\\u0674-\\u0677\\u0688-\\u0699\\u06c0\\u06c3-\\u06cb\\u06cd\\u06cf\\u06d2\\u06d3\\u06d5\\u06ee\\u06ef' +
  '\\u0759-\\u075b\\u076b\\u076c\\u0771\\u0773\\u0774\\u0778\\u0779\\u08aa-\\u08ad\\u08ae\\u08b1\\u08b2\\u08b9]',
)
const ARABIC_LETTER = /[\u0621-\u064a\u066e-\u06d3\u06d5\u06ee\u06ef\u06fa-\u06fc\u06ff\u0750-\u077f\u08a0-\u08c9]/
/** Harakat and other combining marks, which sit on a letter without ending the word. */
const MARK = /[\u064b-\u065f\u0670\u06d6-\u06ed]/
/** Replaced or line-breaking content between two text nodes means they are not one word. */
const BREAKING = 'br,wbr,img,svg,video,canvas,input,button,select,textarea,iframe,object'
const ATOMIC: Record<string, JoinBreak['reason']> = { 'inline-block': 'inline-block', 'inline-flex': 'other' }
const ZWJ = '\u200d'
const FORM_GAP = 0.5

/** Index of the last letter before any trailing marks, or -1 when the text does not end in a letter that joins leftwards. */
function lastJoining(s: string): number {
  let i = s.length - 1
  while (i >= 0 && MARK.test(s[i]!)) i--
  const ch = s[i] ?? ''
  return ARABIC_LETTER.test(ch) && !NO_LEFT_JOIN.test(ch) ? i : -1
}
/** U+0640 (tatweel) is an explicit connector, as in the Hijri abbreviation, so a boundary next to it is never a split word. */
const TATWEEL = '\u0640'
export const touchesTatweel = (before: string, last: number, text: string): boolean => before[last] === TATWEEL || text[0] === TATWEEL
const startsJoining = (s: string): boolean => {
  const ch = s[0] ?? ''
  return ARABIC_LETTER.test(ch) && !MARK.test(ch) && ch !== '\u0621' && ch !== '\u0674' && ch !== '\u08ad'
}

/** The nearest ancestor of the node, below the common ancestor, that is an atomic inline box (it shapes its text on its own). */
function atomicAbove(node: Node, common: Node | null, style: Style): { el: Element; reason: JoinBreak['reason'] } | null {
  for (let el = node.parentElement; el && el !== common; el = el.parentElement) {
    const reason = ATOMIC[style(el).display]
    if (reason) return { el, reason }
  }
  return null
}

const letterWidth = (doc: Document, node: Node, at: number): number => {
  const range = doc.createRange()
  range.setStart(node, at)
  range.setEnd(node, at + 1)
  return range.getClientRects()[0]?.width ?? 0
}

/** The two reference widths for a boundary letter: drawn joined to its neighbour, and drawn alone. */
export type Forms = [joined: number, alone: number]

/**
 * Pure verdict for one side of the boundary: true when the rendered width is nearest the non-joining form, false when
 * nearest the joining form, null when the forms cannot be told apart. `forms` is asked for the ZWJ references first;
 * some fonts lack U+200D and break the run at it, which hides the join, so when those are within half a pixel it is
 * asked again with the other side's real letter in place of the ZWJ.
 */
export function sideVerdict(measured: number, forms: (joiner: 'zwj' | 'neighbour') => Forms): boolean | null {
  let [joined, alone] = forms('zwj')
  if (Math.abs(joined - alone) <= FORM_GAP) [joined, alone] = forms('neighbour')
  if (Math.abs(joined - alone) <= FORM_GAP) return null
  return Math.abs(measured - alone) < Math.abs(measured - joined)
}

/** The boundary is painted apart when either side's letter is nearest its non-joining form. */
export const boundarySplit = (first: boolean | null, second: boolean | null): boolean => first === true || second === true

/**
 * The verdict for the letter at `at` in the text node, measured against a hidden probe in the same parent. The probe is
 * a child of the node's own parent, absolutely positioned so the line does not reflow, so it inherits the same
 * ancestor transforms and zoom as the measured letter. It is removed in finally, and a probe that cannot run says nothing.
 */
function paintedSplit(doc: Document, node: Text, at: number, side: 'end' | 'start', neighbour: string, style: Style): boolean | null {
  const parent = node.parentElement!
  let probe: HTMLElement | null = null
  try {
    const s = style(parent)
    probe = doc.createElement('span')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;letter-spacing:0'
    probe.style.fontFamily = s.fontFamily
    probe.style.fontSize = s.fontSize
    probe.style.fontWeight = s.fontWeight
    probe.style.fontStyle = s.fontStyle
    probe.style.fontStretch = s.fontStretch
    probe.style.fontFeatureSettings = s.fontFeatureSettings
    probe.style.fontVariationSettings = s.fontVariationSettings
    probe.style.direction = s.direction
    parent.appendChild(probe)
    const el = probe
    const widthOf = (text: string, index: number): number => {
      el.textContent = text
      return letterWidth(doc, el.firstChild!, index)
    }
    const letter = node.data[at]!
    // The letter's own neighbour inside its text node stays, so the form being compared is the one it would take in the word.
    const before = side === 'end' && at > 0 ? node.data[at - 1]! : ''
    const after = side === 'start' ? (node.data[at + 1] ?? '') : ''
    return sideVerdict(letterWidth(doc, node, at), (kind) => {
      const joiner = kind === 'zwj' ? ZWJ : neighbour
      return side === 'end'
        ? [widthOf(before + letter + joiner, before.length), widthOf(before + letter, before.length)]
        : [widthOf(joiner + letter + after, joiner.length), widthOf(letter + after, 0)]
    })
  } catch {
    return null
  } finally {
    probe?.remove()
  }
}

/** Whether the font change between the two text nodes painted the boundary letters apart. Never throws. */
function fontSplit(doc: Document, style: Style, prev: Text, last: number, n: Text): boolean {
  return boundarySplit(
    paintedSplit(doc, prev, last, 'end', n.data[0]!, style),
    paintedSplit(doc, n, 0, 'start', prev.data[last]!, style),
  )
}

/**
 * Words that Chromium paints apart. An inline-block or inline-flex box always splits the word. A font-family change
 * splits it on some platforms only, so it is measured in the page (fontSplit). Colour, `<b>` and padding keep the join
 * (verify.test.ts), so they are not looked at.
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
    const last = before ? lastJoining(before) : -1
    if (last < 0 || !startsJoining(text) || touchesTatweel(before, last, text)) continue
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
    const atomic = atomicAbove(n, common, style) ?? atomicAbove(prev, common, style)
    const differentFont = !atomic && style(a).fontFamily !== style(b).fontFamily
    if (!atomic && !differentFont) continue
    const el = atomic ? atomic.el : b
    if (seen.has(el)) continue
    if (differentFont && !fontSplit(doc, style, prev, last, n)) continue
    seen.add(el)
    const word = (before.match(/\S+$/)?.[0] ?? '') + (text.match(/^\S+/)?.[0] ?? '')
    out.push({ ...ref(el), reason: atomic ? atomic.reason : 'font-family', word })
  }
  return out
}
