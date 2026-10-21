import type { PhysicalDeclaration } from '../model'

export const PHYSICAL = /^(margin|padding)-(left|right)$|^(left|right|float)$|^border-(left|right)-width$|^border-(top|bottom)-(left|right)-radius$/

export type Authored = Map<Element, Set<string>>

const hasPhysical = (decl: CSSStyleDeclaration): boolean => {
  for (let i = 0; i < decl.length; i++) if (PHYSICAL.test(decl.item(i))) return true
  return false
}

const RTL_SIGNALS: RegExp[] = [
  /:dir\(\s*["']?rtl["']?\s*\)/i,
  /\[\s*dir\s*=\s*["']?\s*rtl\s*["']?(\s+[is])?\s*\]/i,
  /\.rtl(?![\w\\-])/,
  /\[\s*lang\s*[\^|]?=\s*["']?\s*ar(?![a-z])/i,
  /:lang\(\s*["']?\s*ar(?![a-z])/i,
]

/** Removes every :not(...) with its balanced contents, at any depth, since a scope inside a negation excludes it. */
function stripNegations(selector: string): string {
  let out = ''
  for (let i = 0; i < selector.length; i++) {
    if (selector[i] === '\\') { out += selector.slice(i, i + 2); i++; continue }
    if (!selector.startsWith(':not(', i)) { out += selector[i]; continue }
    let depth = 0
    let j = i + 4
    for (; j < selector.length; j++) {
      if (selector[j] === '\\') j++
      else if (selector[j] === '(') depth++
      else if (selector[j] === ')' && --depth === 0) break
    }
    i = j
  }
  return out
}

/** True when any part of the selector only applies to right-to-left or Arabic content, so a physical side in it is deliberate. */
export function rtlScoped(selector: string): boolean {
  const positive = stripNegations(selector)
  return RTL_SIGNALS.some((signal) => signal.test(positive))
}

/** Splits a selector list at its top-level commas, leaving commas inside brackets, parentheses and quotes alone. */
function splitList(list: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote = ''
  let from = 0
  for (let i = 0; i < list.length; i++) {
    const c = list[i]
    if (c === '\\') i++
    else if (quote) { if (c === quote) quote = '' }
    else if (c === '"' || c === "'") quote = c
    else if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    else if (c === ',' && depth === 0) { parts.push(list.slice(from, i)); from = i + 1 }
  }
  parts.push(list.slice(from))
  return parts.map((p) => p.trim()).filter(Boolean)
}

/**
 * Finds which elements author a physical (left/right) property in a readable stylesheet. Declarations whose matching
 * selector is right-to-left scoped are skipped, and so are inline styles (set by script, already computed for the direction).
 */
export function authoredPhysical(doc: Document, win: Window): { authored: Authored; unreadable: number } {
  const authored: Authored = new Map()
  let unreadable = 0
  const add = (el: Element, decl: CSSStyleDeclaration) => {
    for (let i = 0; i < decl.length; i++) {
      const name = decl.item(i)
      if (PHYSICAL.test(name)) authored.set(el, (authored.get(el) ?? new Set()).add(name))
    }
  }
  const walkSheet = (sheet: CSSStyleSheet) => {
    try { walk(sheet.cssRules) } catch { unreadable++ }
  }
  const walk = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if ('media' in rule && !win.matchMedia((rule.media as MediaList).mediaText || 'all').matches) continue
      if ('styleSheet' in rule && rule.styleSheet) walkSheet(rule.styleSheet as CSSStyleSheet)
      if ('selectorText' in rule && 'style' in rule && hasPhysical(rule.style as CSSStyleDeclaration)) {
        for (const selector of splitList(String(rule.selectorText))) {
          if (rtlScoped(selector)) continue
          let els: Element[] = []
          try { els = Array.from(doc.querySelectorAll(selector)) } catch { els = [] }
          for (const el of els) add(el, rule.style as CSSStyleDeclaration)
        }
      }
      if ('cssRules' in rule && rule.cssRules) walk(rule.cssRules as CSSRuleList)
    }
  }
  for (const sheet of Array.from(doc.styleSheets)) walkSheet(sheet)
  return { authored, unreadable }
}

const ASYMMETRIC: Record<string, (s: CSSStyleDeclaration) => boolean> = {
  'margin-left': (s) => s.marginLeft !== s.marginRight,
  'margin-right': (s) => s.marginLeft !== s.marginRight,
  'padding-left': (s) => s.paddingLeft !== s.paddingRight,
  'padding-right': (s) => s.paddingLeft !== s.paddingRight,
  float: (s) => s.float === 'left' || s.float === 'right',
  'border-left-width': (s) => s.borderLeftWidth !== s.borderRightWidth,
  'border-right-width': (s) => s.borderLeftWidth !== s.borderRightWidth,
  'border-top-left-radius': (s) => s.borderTopLeftRadius !== s.borderTopRightRadius,
  'border-top-right-radius': (s) => s.borderTopLeftRadius !== s.borderTopRightRadius,
  'border-bottom-left-radius': (s) => s.borderBottomLeftRadius !== s.borderBottomRightRadius,
  'border-bottom-right-radius': (s) => s.borderBottomLeftRadius !== s.borderBottomRightRadius,
}

const INACTIVE = new Set(['', '0px', '0', 'auto', 'none', 'normal'])
const INSET = new Set(['left', 'right'])
const CENTRE_TOLERANCE_PX = 1

/** The left edge and width of the box an inset is measured against (its padding box). */
function containingBox(el: Element, s: CSSStyleDeclaration): { left: number; width: number } {
  const root = el.ownerDocument.documentElement
  const viewport = { left: 0, width: root.clientWidth }
  if (s.position === 'fixed') return viewport
  const parent = s.position === 'absolute' ? (el as HTMLElement).offsetParent : el.parentElement
  if (!parent) return viewport
  const view = el.ownerDocument.defaultView
  if (s.position === 'absolute' && parent === el.ownerDocument.body && view?.getComputedStyle(parent).position === 'static') return viewport
  return { left: parent.getBoundingClientRect().left + parent.clientLeft, width: parent.clientWidth }
}

/** left: 50% with a -50% translate, and the like: the element sits in the middle, so it mirrors itself. */
function centred(el: Element, s: CSSStyleDeclaration): boolean {
  const box = containingBox(el, s)
  const r = el.getBoundingClientRect()
  return Math.abs(r.left + r.width / 2 - (box.left + box.width / 2)) <= CENTRE_TOLERANCE_PX
}

/** Positioned elements resolve auto insets to pixels, so read the computed (not resolved) value. */
function autoInset(el: Element, property: string): boolean {
  const map = (el as Element & { computedStyleMap?: () => { get: (p: string) => unknown } }).computedStyleMap?.()
  return String(map?.get(property) ?? '') === 'auto'
}

function reportableInset(property: string, s: CSSStyleDeclaration, el: Element | undefined): boolean {
  if (s.position === 'static' || s.left === s.right || s.getPropertyValue(property) === 'auto') return false
  return el === undefined || (!autoInset(el, property) && !centred(el, s))
}

/**
 * A property only counts when its own computed value is set (a later rule may have zeroed it) and the pair differs.
 * left and right are the exception: 0 is a real position, only auto is unset.
 */
export function reportable(property: string, s: CSSStyleDeclaration, el?: Element): boolean {
  if (INSET.has(property)) return reportableInset(property, s, el)
  if (property !== 'float' && INACTIVE.has(s.getPropertyValue(property))) return false
  return ASYMMETRIC[property]?.(s) ?? false
}

export const physicalOf = (properties: Iterable<string>, s: CSSStyleDeclaration, el?: Element): PhysicalDeclaration[] =>
  Array.from(properties).filter((p) => reportable(p, s, el)).map((p) => ({ property: p, value: s.getPropertyValue(p) }))
