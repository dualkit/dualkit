import type { Container, Rule } from 'postcss'

const MAX_SELECTORS = 64

const isRule = (node: Container | undefined): node is Rule => node?.type === 'rule'

function combine(parents: readonly string[], own: readonly string[]): string[] {
  if (parents.length === 0) return [...own]
  const out: string[] = []
  for (const parent of parents) {
    for (const child of own) {
      out.push(child.includes('&') ? child.replace(/&/g, parent) : `${parent} ${child}`)
      if (out.length >= MAX_SELECTORS) return out
    }
  }
  return out
}

/** The rule's selectors joined with every ancestor rule's selectors, with & resolved. At-rules in between are skipped. */
export function fullSelectors(rule: Rule): string[] {
  const chain: Rule[] = []
  for (let node: Container | undefined = rule; node; node = node.parent as Container | undefined) if (isRule(node)) chain.unshift(node)
  return chain.reduce<string[]>((acc, r) => combine(acc, r.selectors), [])
}

const DIR_ATTRIBUTE = /\[\s*dir\s*[~|^$*]?=/i
const DIR_PSEUDO = /:dir\(/i
const LANG_AR_PSEUDO = /:lang\(\s*["']?ar(?![a-z0-9])/i

/** True for [dir=…] in any quoting, :dir(…) and :lang(ar…). Such a selector is a deliberate direction rule. */
export const directionScoped = (selector: string): boolean =>
  DIR_ATTRIBUTE.test(selector) || DIR_PSEUDO.test(selector) || LANG_AR_PSEUDO.test(selector)

/** A direction part with an optional html, body or :root it is attached to: html[dir=rtl], :dir(rtl), :lang(ar). */
const DIRECTION_PART = /(?:\b(?:html|body)|:root)?(?:\[\s*dir\s*[~|^$*]?=[^\]]*\]|:dir\([^)]*\)|:lang\(\s*["']?ar[^)]*\))+/gi

/** The selector with its direction parts removed, in one spacing, so [dir=rtl] .n and .n:dir(rtl) both give .n. */
export const withoutDirection = (selector: string): string =>
  selector.replace(DIRECTION_PART, '').replace(/\s*([>+~])\s*/g, ' $1 ').trim().replace(/^[>+~]\s*/, '').replace(/\s+/g, ' ')

const NOT_PSEUDO = /:not\([^()]*(?:\([^()]*\)[^()]*)*\)/gi
const LANG_AR_ATTRIBUTE = /\[\s*lang\s*[|^]?=\s*["']?ar(?:-|["'\]\s]|$)/i
const DIR_RTL = /:dir\(\s*rtl\s*\)|\[\s*dir\s*=\s*["']?rtl["']?\s*\]/i

/** True for :lang(ar…), [lang="ar…"], [lang|="ar"], :dir(rtl) and [dir="rtl"]. A match inside :not() does not count. */
export function targetsArabic(selector: string): boolean {
  const s = selector.replace(NOT_PSEUDO, '')
  return LANG_AR_PSEUDO.test(s) || LANG_AR_ATTRIBUTE.test(s) || DIR_RTL.test(s)
}
