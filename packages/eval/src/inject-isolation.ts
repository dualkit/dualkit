import type { HTMLElement } from 'node-html-parser'
import { removeAttr, removeStyleDecl, retag, tagOf, type Edit } from './inject-html.js'
import { declsOf, type Rule } from './inject-style.js'

/** Whether an element carries its own bidi isolation: a bdi, a dir attribute, or inline unicode-bidi. */
export const isolates = (el: HTMLElement) =>
  tagOf(el) === 'bdi' || el.hasAttribute('dir') || /unicode-bidi\s*:\s*(isolate|embed|plaintext)/i.test(el.getAttribute('style') ?? '')

/** Opening-tag edit that takes the isolation off an element. A bdi becomes a span so the marker has a home. */
export function unisolate(html: string, el: HTMLElement, kind: string): readonly Edit[] {
  const transform = (rest: string) => removeStyleDecl(removeAttr(rest, 'dir'), 'unicode-bidi')
  return tagOf(el) === 'bdi' ? retag(html, el, kind, { tag: 'span', transform }) : retag(html, el, kind, { transform })
}

/** Whether a stylesheet, or a dir on an ancestor, already forces LTR or isolation, which would make removing it here a no-op. */
export function forcesLtr(el: HTMLElement, rules: readonly Rule[]): boolean {
  for (let cur: HTMLElement | null = el; cur && cur.rawTagName; cur = cur.parentNode as HTMLElement | null) {
    if (cur !== el && (cur.getAttribute('dir') ?? '').toLowerCase() === 'ltr') return true
    if (/direction\s*:\s*ltr|unicode-bidi\s*:\s*(isolate|embed|bidi-override|plaintext)/i.test(declsOf(cur, rules))) return true
  }
  return false
}

/** Whether a script on the page names this element's id or class, and so may rewrite its text at runtime. */
export function scriptNames(html: string, el: HTMLElement): boolean {
  const code = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]!).join('\n')
  const names = [el.getAttribute('id') ?? '', ...(el.getAttribute('class') ?? '').split(/\s+/)].filter((n) => n !== '')
  return names.some((n) => new RegExp(`(^|[^\\w-])${n.replace(/[^\w-]/g, '\\$&')}($|[^\\w-])`).test(code))
}
