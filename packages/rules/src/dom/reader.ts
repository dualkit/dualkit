import type { Direction, FieldKind, FieldNode, Font, IconNode, LayoutNode, NodeRef, PhysicalDeclaration, Rect, ScreenModel, TextRun } from '../model'

export type ReadOptions = { exclude?: string[] }

const SKIP_TEXT = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TITLE'])
const PHYSICAL = /^(margin|padding)-(left|right)$|^(left|right|float)$|^border-(left|right)-width$|^border-(top|bottom)-(left|right)-radius$/
const ICON_CLASS = /^(lucide-|fa-|icon-|bi-|ri-|ti-|i-)(.+)$/
const ICON_CLASS_SKIP = /^(fa-(solid|regular|light|thin|duotone|brands|sharp)|fa-\d?x|fa-fw|icon-(sm|md|lg))$/
const CODE_FIELD = /iban|card|cc-number|otp|one-time-code|postal|zip|code/i

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
  const ref = (el: Element, box: Rect = rect(el.getBoundingClientRect())): NodeRef => ({ id: pathOf(el), snippet: el.outerHTML.slice(0, 160), box })

  const { authored, unreadable } = authoredPhysical(doc, win)
  return {
    root: { lang: doc.documentElement.getAttribute('lang') || null, dir: doc.documentElement.getAttribute('dir') || doc.body?.getAttribute('dir') || null },
    texts: readTexts(doc, style, skipped, visible, ref, rect),
    layouts: readLayouts(doc, style, skipped, visible, ref, authored),
    icons: readIcons(doc, style, skipped, visible, ref),
    fields: readFields(doc, style, skipped, visible, ref),
    unreadableStylesheets: unreadable,
  }
}

type Style = (el: Element) => CSSStyleDeclaration
type Pred = (el: Element) => boolean
type Ref = (el: Element, box?: Rect) => NodeRef

function pathOf(el: Element): string {
  const parts: string[] = []
  let node: Element | null = el
  while (node && parts.length < 4 && node.tagName !== 'HTML') {
    const tag = node.tagName.toLowerCase()
    if (node.id) { parts.unshift(`${tag}#${node.id}`); break }
    const cls = typeof node.className === 'string' ? node.className.trim().split(/\s+/)[0] : ''
    const parent: Element | null = node.parentElement
    const same = parent ? Array.from(parent.children).filter((c) => c.tagName === node!.tagName) : []
    const nth = same.length > 1 ? `:nth-of-type(${same.indexOf(node) + 1})` : ''
    parts.unshift(`${tag}${cls ? `.${cls}` : ''}${nth}`)
    node = parent
  }
  return parts.join(' > ')
}

const dirOf = (s: CSSStyleDeclaration): Direction => (s.direction === 'rtl' ? 'rtl' : 'ltr')
const clean = (s: string) => s.replace(/\s+/g, ' ').trim()

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
    if (node.tagName === 'BDI' || node.hasAttribute('dir') || /isolate|plaintext/.test(style(node).unicodeBidi)) return true
    node = node.parentElement
  }
  return false
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

function readTexts(doc: Document, style: Style, skipped: Pred, visible: Pred, ref: Ref, rect: (r: DOMRect) => Rect): TextRun[] {
  const runs: TextRun[] = []
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement
    const text = clean(node.textContent ?? '')
    if (!parent || !text || SKIP_TEXT.has(parent.tagName) || parent.closest('svg') || skipped(parent) || !visible(parent)) continue
    const range = doc.createRange()
    range.selectNodeContents(node)
    const lines = new Set(Array.from(range.getClientRects()).map((r) => Math.round(r.top))).size
    const block = blockOf(parent, style)
    const blockText = clean(block.textContent ?? '')
    const s = style(parent)
    runs.push({
      ...ref(parent, rect(range.getBoundingClientRect())),
      text, blockId: pathOf(block), blockText, blockDir: dirOf(style(block)), dir: dirOf(s),
      lang: parent.closest('[lang]')?.getAttribute('lang') || null,
      isolated: isolatedBelow(parent, block, style), isLastInBlock: blockText.endsWith(text),
      font: fontOf(s), lines: Math.max(1, lines),
    })
  }
  return runs
}

type Authored = Map<Element, Set<string>>

function authoredPhysical(doc: Document, win: Window): { authored: Authored; unreadable: number } {
  const authored: Authored = new Map()
  let unreadable = 0
  const add = (el: Element, decl: CSSStyleDeclaration) => {
    for (let i = 0; i < decl.length; i++) {
      const name = decl.item(i)
      if (PHYSICAL.test(name)) authored.set(el, (authored.get(el) ?? new Set()).add(name))
    }
  }
  const walk = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if ('media' in rule && !win.matchMedia((rule.media as MediaList).mediaText || 'all').matches) continue
      if ('selectorText' in rule && 'style' in rule) {
        let els: Element[] = []
        try { els = Array.from(doc.querySelectorAll(String(rule.selectorText))) } catch { els = [] }
        for (const el of els) add(el, rule.style as CSSStyleDeclaration)
      }
      if ('cssRules' in rule && rule.cssRules) walk(rule.cssRules as CSSRuleList)
    }
  }
  for (const sheet of Array.from(doc.styleSheets)) {
    try { walk(sheet.cssRules) } catch { unreadable++ }
  }
  for (const el of Array.from(doc.querySelectorAll('[style]'))) add(el, (el as HTMLElement).style)
  return { authored, unreadable }
}

const ASYMMETRIC: Record<string, (s: CSSStyleDeclaration) => boolean> = {
  'margin-left': (s) => s.marginLeft !== s.marginRight,
  'margin-right': (s) => s.marginLeft !== s.marginRight,
  'padding-left': (s) => s.paddingLeft !== s.paddingRight,
  'padding-right': (s) => s.paddingLeft !== s.paddingRight,
  left: (s) => s.position !== 'static' && s.left !== s.right,
  right: (s) => s.position !== 'static' && s.left !== s.right,
  float: (s) => s.float === 'left' || s.float === 'right',
  'border-left-width': (s) => s.borderLeftWidth !== s.borderRightWidth,
  'border-right-width': (s) => s.borderLeftWidth !== s.borderRightWidth,
  'border-top-left-radius': (s) => s.borderTopLeftRadius !== s.borderTopRightRadius,
  'border-top-right-radius': (s) => s.borderTopLeftRadius !== s.borderTopRightRadius,
  'border-bottom-left-radius': (s) => s.borderBottomLeftRadius !== s.borderBottomRightRadius,
  'border-bottom-right-radius': (s) => s.borderBottomLeftRadius !== s.borderBottomRightRadius,
}

function readLayouts(doc: Document, style: Style, skipped: Pred, visible: Pred, ref: Ref, authored: Authored): LayoutNode[] {
  const out: LayoutNode[] = []
  for (const el of Array.from(doc.body.querySelectorAll('*'))) {
    if (el.closest('svg') || SKIP_TEXT.has(el.tagName) || skipped(el) || !visible(el)) continue
    const s = style(el)
    const physical: PhysicalDeclaration[] = Array.from(authored.get(el) ?? [])
      .filter((p) => ASYMMETRIC[p]?.(s))
      .map((p) => ({ property: p, value: s.getPropertyValue(p) }))
    const hasOwnText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && clean(n.textContent ?? '') !== '')
    const textAlign = s.textAlign
    if (physical.length > 0 || (hasOwnText && (textAlign === 'left' || textAlign === 'right'))) {
      out.push({ ...ref(el), dir: dirOf(s), textAlign, hasOwnText, physical })
    }
  }
  return out
}

/** PascalCase and camelCase become kebab-case, then everything is lowercased. */
const kebab = (name: string): string => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

function iconName(el: Element): string | null {
  const attr = el.getAttribute('aria-label') ?? el.getAttribute('data-icon') ?? el.getAttribute('data-lucide')
  if (attr) return kebab(attr)
  const use = el.querySelector('use')?.getAttribute('href') ?? el.querySelector('use')?.getAttribute('xlink:href')
  if (use) return kebab(use.replace(/^.*#/, ''))
  const cls = (el.getAttribute('class') ?? '').split(/\s+/).find((c) => ICON_CLASS.test(c) && !ICON_CLASS_SKIP.test(c))
  if (cls) return kebab(cls.replace(ICON_CLASS, '$2'))
  if (el.tagName === 'IMG') {
    const img = el as HTMLImageElement
    return kebab(img.alt || img.getAttribute('src')?.split('/').pop()?.replace(/\.\w+$/, '') || '') || null
  }
  if (/material-(icons|symbols)/.test(el.getAttribute('class') ?? '')) return kebab(clean(el.textContent ?? '')) || null
  return null
}

function mirrored(el: Element, style: Style): boolean {
  let node: Element | null = el
  for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
    const s = style(node)
    const m = /matrix(?:3d)?\(([^)]+)\)/.exec(s.transform)
    if (m && parseFloat(m[1]!.split(',')[0]!) < 0) return true
    if (s.scale && s.scale !== 'none' && parseFloat(s.scale) < 0) return true
  }
  return false
}

function readIcons(doc: Document, style: Style, skipped: Pred, visible: Pred, ref: Ref): IconNode[] {
  const candidates = doc.body.querySelectorAll('svg, img, i, span[class*="icon"], [data-icon], [data-lucide], .material-icons, .material-symbols-outlined')
  const out: IconNode[] = []
  for (const el of Array.from(candidates)) {
    if (el.parentElement?.closest('svg') || skipped(el) || !visible(el)) continue
    const r = el.getBoundingClientRect()
    if (r.width > 64 || r.height > 64) continue
    out.push({ ...ref(el), name: iconName(el), dir: dirOf(style(el)), mirrored: mirrored(el, style) })
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
