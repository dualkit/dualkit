import type { FieldKind, FieldNode, Font, LayoutNode, NodeRef, Rect, ScreenModel, TextRun } from '../model'
import { readIcons } from './icons'
import { makePathOf } from './path'
import { authoredPhysical, physicalOf, type Authored } from './styles'
import { clean, dirOf, type Pred, type Ref, type Style } from './types'

export type ReadOptions = { exclude?: string[] }

const SKIP_TEXT = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TITLE'])
const CODE_FIELD = /iban|card|cc-number|otp|one-time-code|postal|zip|code/i
const ISOLATING_DIR = /^(ltr|rtl|auto)$/i
const BLOCK_TEXT_CAP = 600
const BLOCK_TEXT_KEEP = 300
const CLIPPED = /^rect\(\s*(0|1)(px)?[\s,)]/

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
  return {
    root: { lang: doc.documentElement.getAttribute('lang') || null, dir: doc.documentElement.getAttribute('dir') || doc.body?.getAttribute('dir') || null },
    texts: readTexts(doc, style, skipped, visible, ref, rect, pathOf),
    layouts: readLayouts(doc, style, skipped, visible, ref, authored),
    icons: readIcons(doc, style, skipped, visible, ref),
    fields: readFields(doc, style, skipped, visible, ref),
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

/** The standard visually-hidden pattern: a 1px box, or a clip that leaves nothing showing. */
function screenReaderOnly(el: Element, s: CSSStyleDeclaration): boolean {
  const r = el.getBoundingClientRect()
  if (r.width <= 1 && r.height <= 1) return true
  return CLIPPED.test(s.clip) || /^inset\(\s*50%/.test(s.clipPath)
}

function readTexts(doc: Document, style: Style, skipped: Pred, visible: Pred, ref: Ref, rect: (r: DOMRect) => Rect, pathOf: (el: Element) => string): TextRun[] {
  const runs: TextRun[] = []
  const blockCache = new Map<Element, { block: Element; id: string; full: string; text: string; dir: ReturnType<typeof dirOf> }>()
  const hidden = new Map<Element, boolean>()
  const newBlockInfo = (block: Element) => {
    const full = clean(block.textContent ?? '')
    return { block, id: pathOf(block), full, text: capBlockText(full), dir: dirOf(style(block)) }
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
    const { block, id, full, text: blockText, dir: blockDir } = blockInfo(parent)
    const s = style(parent)
    runs.push({
      ...ref(parent, rect(range.getBoundingClientRect())),
      text, blockId: id, blockText, blockDir, dir: dirOf(s),
      lang: parent.closest('[lang]')?.getAttribute('lang') || null,
      isolated: isolatedBelow(parent, block, style), isLastInBlock: full.endsWith(text),
      font: fontOf(s), lines: Math.max(1, lines),
    })
  }
  return runs
}

function readLayouts(doc: Document, style: Style, skipped: Pred, visible: Pred, ref: Ref, authored: Authored): LayoutNode[] {
  const out: LayoutNode[] = []
  for (const el of Array.from(doc.body.querySelectorAll('*'))) {
    if (el.closest('svg') || SKIP_TEXT.has(el.tagName) || skipped(el) || !visible(el)) continue
    const s = style(el)
    const physical = physicalOf(authored.get(el) ?? [], s)
    const hasOwnText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && clean(n.textContent ?? '') !== '')
    const textAlign = s.textAlign
    if (physical.length > 0 || (hasOwnText && (textAlign === 'left' || textAlign === 'right'))) {
      out.push({ ...ref(el), dir: dirOf(s), textAlign, hasOwnText, physical })
    }
  }
  return out
}

function fieldKind(el: HTMLInputElement | HTMLTextAreaElement): FieldKind {
  const type = el.getAttribute('type')?.toLowerCase()
  if (type === 'email' || type === 'tel' || type === 'url' || type === 'number') return type
  const hints = [el.getAttribute('name'), el.id, el.getAttribute('autocomplete'), el.getAttribute('inputmode')].join(' ')
  return CODE_FIELD.test(hints) ? 'code' : 'text'
}

function readFields(doc: Document, style: Style, skipped: Pred, visible: Pred, ref: Ref): FieldNode[] {
  const out: FieldNode[] = []
  for (const el of Array.from(doc.body.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'))) {
    const type = el.getAttribute('type')?.toLowerCase()
    if (type === 'hidden' || type === 'checkbox' || type === 'radio' || type === 'submit' || type === 'button') continue
    if (skipped(el) || !visible(el)) continue
    out.push({ ...ref(el), kind: fieldKind(el), dir: dirOf(style(el)), dirAttr: el.getAttribute('dir') })
  }
  return out
}
