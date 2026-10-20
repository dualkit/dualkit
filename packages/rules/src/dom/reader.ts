import type { LoadedFace, FieldKind, FieldNode, Font, LayoutNode, NodeRef, Rect, ScreenModel, TextRun } from '../model'
import { readClips } from './clips'
import { readFonts } from './fonts'
import { readIcons } from './icons'
import { readSigns } from './signs'
import { readLabels } from './labels'
import { screenReaderOnly } from './hidden'
import { mirrorRoot } from './mirror'
import { makePathOf } from './path'
import { arabicShare, arabicWordCount, hasArabic } from '../text'
import { authoredPhysical, physicalOf, type Authored } from './styles'
import { clean, dirOf, type Pred, type Ref, type Style } from './types'

export type ReadOptions = { exclude?: string[] }

const SKIP_TEXT = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TITLE'])
/** Whole words only, so cardholder_name and country_code stay plain text. camelCase is split into words first. */
const CODE_FIELD = /(^|[^a-z])(iban|otp|one-time-code|postal|zip|postcode|zipcode)([^a-z]|$)|(^|[^a-z])(?<!country[-_ ]?)code([^a-z]|$)|card[-_ ]?number|cc-number/i
const splitCamel = (s: string): string => s.replace(/([a-z])([A-Z])/g, '$1 $2')
const ISOLATING_DIR = /^(ltr|rtl|auto)$/i
const BLOCK_TEXT_CAP = 600
const BLOCK_TEXT_KEEP = 300

export function readScreen(doc: Document, options: ReadOptions = {}): ScreenModel {
  const win = doc.defaultView!
  const style = (el: Element) => win.getComputedStyle(el)
  const exclude = (options.exclude ?? []).filter((sel) => {
    try { doc.querySelector(sel); return true } catch { return false }
  })
  const skipped = (el: Element) => exclude.some((sel) => el.closest(sel) !== null)
  const visible = (el: Element) => {
    const s = style(el)
    const r = el.getBoundingClientRect()
    return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0
  }
  const rect = (r: DOMRect): Rect => ({ x: r.x + win.scrollX, y: r.y + win.scrollY, width: r.width, height: r.height })
  const pathOf = makePathOf()
  const ref: Ref = (el, box = rect(el.getBoundingClientRect())): NodeRef => ({ id: pathOf(el), snippet: el.outerHTML.slice(0, 160), box })

  const { authored, unreadable } = authoredPhysical(doc, win)
  const fonts = readFonts(doc)
  return {
    root: {
      lang: doc.documentElement.getAttribute('lang') || null,
      dir: doc.documentElement.getAttribute('dir') || doc.body?.getAttribute('dir') || null,
      // The body inherits from <html> unless it sets its own dir, so it is where the page's direction lands.
      computedDir: dirOf(style(doc.body ?? doc.documentElement)),
    },
    texts: readTexts(doc, style, skipped, visible, ref, rect, pathOf, fonts),
    layouts: readLayouts(doc, style, skipped, visible, ref, authored),
    icons: readIcons(doc, style, skipped, visible, ref),
    fields: readFields(doc, style, skipped, visible, ref),
    fonts,
    labels: readLabels(doc, skipped, visible, ref),
    clips: readClips(doc, style, skipped, visible, ref, screenReaderOnly),
    unreadableStylesheets: unreadable,
  }
}

function blockOf(el: Element, style: Style): Element {
  let node: Element | null = el
  while (node) {
    const d = style(node).display
    if (d !== 'inline' && d !== 'contents') return node
    node = node.parentElement
  }
  return el
}

function isolatedBelow(el: Element, block: Element, style: Style): boolean {
  let node: Element | null = el
  while (node && node !== block) {
    if (node.tagName === 'BDI' || ISOLATING_DIR.test(node.getAttribute('dir') ?? '') || /isolate|plaintext/.test(style(node).unicodeBidi)) return true
    node = node.parentElement
  }
  return false
}

/** What touches this text on one side, climbing out of inline tags up to the block: a <br>, the block's edge, or other content. */
function edgeOf(node: Node, block: Element, side: 'previousSibling' | 'nextSibling'): 'br' | 'edge' | 'content' {
  let at: Node | null = node
  while (at && at !== block) {
    let near = at[side]
    while (near && near.nodeType === 3 && clean(near.textContent ?? '') === '') near = near[side]
    if (near) return near.nodeName === 'BR' ? 'br' : 'content'
    at = at.parentNode
  }
  return 'edge'
}

/** True for a run that is a whole line closed by a <br>: nothing else on its line, so the run alone decides how the line reads. */
function endsLine(node: Node, block: Element): boolean {
  return edgeOf(node, block, 'nextSibling') === 'br' && edgeOf(node, block, 'previousSibling') !== 'content'
}

/** Long blocks keep their first and last 300 characters, so the model stays small however many runs share a block. */
function capBlockText(full: string): string {
  return full.length <= BLOCK_TEXT_CAP ? full : `${full.slice(0, BLOCK_TEXT_KEEP)}…${full.slice(-BLOCK_TEXT_KEEP)}`
}

function fontOf(s: CSSStyleDeclaration): Font {
  return {
    families: s.fontFamily.split(',').map((f) => f.trim().replace(/^["']|["']$/g, '')),
    size: parseFloat(s.fontSize),
    lineHeight: s.lineHeight === 'normal' ? null : parseFloat(s.lineHeight),
    letterSpacing: s.letterSpacing === 'normal' ? 0 : parseFloat(s.letterSpacing),
    style: s.fontStyle.startsWith('oblique') ? 'oblique' : s.fontStyle === 'italic' ? 'italic' : 'normal',
    weight: parseInt(s.fontWeight, 10),
  }
}

function readTexts(doc: Document, style: Style, skipped: Pred, visible: Pred, ref: Ref, rect: (r: DOMRect) => Rect, pathOf: (el: Element) => string, fonts: LoadedFace[]): TextRun[] {
  const runs: TextRun[] = []
  type BlockInfo = { block: Element; id: string; full: string; text: string; dir: ReturnType<typeof dirOf>; facts: Pick<TextRun, 'blockArabicShare' | 'blockHasArabic' | 'blockArabicWords'> }
  const blockCache = new Map<Element, BlockInfo>()
  const hidden = new Map<Element, boolean>()
  const newBlockInfo = (block: Element): BlockInfo => {
    const full = clean(block.textContent ?? '')
    const facts = { blockArabicShare: arabicShare(full), blockHasArabic: hasArabic(full), blockArabicWords: arabicWordCount(full) }
    return { block, id: pathOf(block), full, text: capBlockText(full), dir: dirOf(style(block)), facts }
  }
  const blockInfo = (parent: Element) => {
    const hit = blockCache.get(parent)
    if (hit) return hit
    const block = blockOf(parent, style)
    const shared = blockCache.get(block)
    const info = shared ?? newBlockInfo(block)
    blockCache.set(parent, info)
    blockCache.set(block, info)
    return info
  }
  const srOnly = (el: Element): boolean => {
    const known = hidden.get(el)
    if (known !== undefined) return known
    const result = screenReaderOnly(el, style(el)) || (el.parentElement !== null && el.parentElement !== doc.body && srOnly(el.parentElement))
    hidden.set(el, result)
    return result
  }
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement
    const text = clean(node.textContent ?? '')
    if (!parent || !text || SKIP_TEXT.has(parent.tagName) || parent.closest('svg') || skipped(parent) || !visible(parent) || srOnly(parent)) continue
    const range = doc.createRange()
    range.selectNodeContents(node)
    const lines = new Set(Array.from(range.getClientRects()).map((r) => Math.round(r.top))).size
    const { block, id, full, text: blockText, dir: blockDir, facts } = blockInfo(parent)
    const s = style(parent)
    const font = fontOf(s)
    const mirroredBy = mirrorRoot(parent, style)
    runs.push({
      ...ref(parent, rect(range.getBoundingClientRect())),
      text, blockId: id, blockText, ...facts, blockDir, dir: dirOf(s),
      lang: parent.closest('[lang]')?.getAttribute('lang') || null,
      isolated: isolatedBelow(parent, block, style), isLastInBlock: full.endsWith(text), endsLine: endsLine(node, block),
      font, signs: readSigns(doc, text, font, fonts), lines: Math.max(1, lines), mirrored: mirroredBy !== null, mirroredBy: mirroredBy && pathOf(mirroredBy),
    })
  }
  return runs
}

function readLayouts(doc: Document, style: Style, skipped: Pred, visible: Pred, ref: Ref, authored: Authored): LayoutNode[] {
  const out: LayoutNode[] = []
  for (const el of Array.from(doc.body.querySelectorAll('*'))) {
    if (el.closest('svg') || SKIP_TEXT.has(el.tagName) || skipped(el) || !visible(el)) continue
    const s = style(el)
    const physical = physicalOf(authored.get(el) ?? [], s, el)
    const ownText = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => clean(n.textContent ?? '')).join(' ').trim()
    const hasOwnText = ownText !== ''
    const textAlign = s.textAlign
    if (physical.length > 0 || (hasOwnText && (textAlign === 'left' || textAlign === 'right'))) {
      out.push({ ...ref(el), dir: dirOf(s), textAlign, hasOwnText, hasArabicText: hasArabic(ownText), physical })
    }
  }
  return out
}

function fieldKind(el: HTMLInputElement | HTMLTextAreaElement): FieldKind {
  const type = el.getAttribute('type')?.toLowerCase()
  if (type === 'email' || type === 'tel' || type === 'url' || type === 'number') return type
  const hints = splitCamel([el.getAttribute('name'), el.id, el.getAttribute('autocomplete'), el.getAttribute('inputmode')].join(' '))
  return CODE_FIELD.test(hints) ? 'code' : 'text'
}

function readFields(doc: Document, style: Style, skipped: Pred, visible: Pred, ref: Ref): FieldNode[] {
  const out: FieldNode[] = []
  for (const el of Array.from(doc.body.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'))) {
    const type = el.getAttribute('type')?.toLowerCase()
    if (type === 'hidden' || type === 'checkbox' || type === 'radio' || type === 'submit' || type === 'button') continue
    if (skipped(el) || !visible(el)) continue
    out.push({ ...ref(el), kind: fieldKind(el), dir: dirOf(style(el)), dirAttr: el.getAttribute('dir'), placeholder: el.getAttribute('placeholder') ?? '', placeholderShown: el.matches(':placeholder-shown') })
  }
  return out
}
