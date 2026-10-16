import type { PhysicalDeclaration } from '../model'

export const PHYSICAL = /^(margin|padding)-(left|right)$|^(left|right|float)$|^border-(left|right)-width$|^border-(top|bottom)-(left|right)-radius$/

export type Authored = Map<Element, Set<string>>

const hasPhysical = (decl: CSSStyleDeclaration): boolean => {
  for (let i = 0; i < decl.length; i++) if (PHYSICAL.test(decl.item(i))) return true
  return false
}

/** Finds which elements author a physical (left/right) property, in any readable stylesheet or inline style. */
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
        let els: Element[] = []
        try { els = Array.from(doc.querySelectorAll(String(rule.selectorText))) } catch { els = [] }
        for (const el of els) add(el, rule.style as CSSStyleDeclaration)
      }
      if ('cssRules' in rule && rule.cssRules) walk(rule.cssRules as CSSRuleList)
    }
  }
  for (const sheet of Array.from(doc.styleSheets)) walkSheet(sheet)
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

const INACTIVE = new Set(['', '0px', '0', 'auto', 'none', 'normal'])

/** A property only counts when its own computed value is set (a later rule may have zeroed it) and the pair differs. */
export function reportable(property: string, s: CSSStyleDeclaration): boolean {
  if (property !== 'float' && INACTIVE.has(s.getPropertyValue(property))) return false
  return ASYMMETRIC[property]?.(s) ?? false
}

export const physicalOf = (properties: Iterable<string>, s: CSSStyleDeclaration): PhysicalDeclaration[] =>
  Array.from(properties).filter((p) => reportable(p, s)).map((p) => ({ property: p, value: s.getPropertyValue(p) }))
