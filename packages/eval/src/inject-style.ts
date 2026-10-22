import type { HTMLElement } from 'node-html-parser'
import { isElement, isText, tagOf } from './inject-html.js'
import type { TextNode } from 'node-html-parser'

/** One flat CSS rule read from a page's style tags. */
export type Rule = { readonly selector: string; readonly body: string }

const STATE_PSEUDO = /:(?!dir\(rtl\)|root)[a-z-]+(\([^)]*\))?/i

/** Every rule in the page's style tags, nested ones flattened. Media conditions are ignored. */
export function rulesOf(html: string): readonly Rule[] {
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]!.replace(/\/\*[\s\S]*?\*\//g, '')).join('\n')
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => !m[1]!.trim().startsWith('@'))
    .flatMap((m) => m[1]!.split(',').map((selector) => ({ selector: selector.trim(), body: m[2]! })))
}

const IGNORED = /\[dir=["']?rtl["']?\]|:dir\(rtl\)|:root/gi

function compoundMatches(el: HTMLElement, compound: string): boolean {
  const c = compound.replace(IGNORED, '')
  if (c === '' || c === '*') return true
  if (c.includes('::') || STATE_PSEUDO.test(c) || /[()]/.test(c)) return false
  const m = /^([a-z][a-z0-9-]*)?((?:[.#][\w-]+|\[[^\]]+\])*)$/i.exec(c)
  if (!m) return false
  const tag = m[1]?.toLowerCase()
  if (tag !== undefined && tag !== tagOf(el) && tag !== 'html' && tag !== 'body') return false
  if (tag === 'html' || tag === 'body') return tagOf(el) === tag || m[2] === ''
  const classes = (el.getAttribute('class') ?? '').split(/\s+/)
  return [...(m[2] ?? '').matchAll(/([.#])([\w-]+)|\[([\w-]+)(?:=["']?([^\]"']*)["']?)?\]/g)].every((p) =>
    p[1] === '.' ? classes.includes(p[2]!) : p[1] === '#' ? el.getAttribute('id') === p[2] : p[4] === undefined ? el.hasAttribute(p[3]!) : el.getAttribute(p[3]!) === p[4],
  )
}

function ruleMatches(el: HTMLElement, selector: string): boolean {
  if (/ltr/i.test(selector)) return false
  const parts = selector.trim().split(/\s*[>+~]\s*|\s+/)
  const last = parts.pop()
  if (last === undefined || !compoundMatches(el, last)) return false
  let anc = el.parentNode as HTMLElement | null
  for (const part of parts.reverse()) {
    while (anc && isElement(anc) && !compoundMatches(anc, part)) anc = anc.parentNode as HTMLElement | null
    if (!anc || !isElement(anc)) return false
    anc = anc.parentNode as HTMLElement | null
  }
  return true
}

/** Declarations that apply to an element, in cascade-ish order: style tags then the inline style. */
export function declsOf(el: HTMLElement, rules: readonly Rule[]): string {
  return [...rules.filter((r) => ruleMatches(el, r.selector)).map((r) => r.body), el.getAttribute('style') ?? ''].join(';')
}

const FLIPPING = /transform\s*:[^;]*(scaleX\(\s*-1\s*\)|scale\(\s*-1|rotate\(\s*180deg\s*\))/i

/** Whether the element, or an ancestor up to and including stop, is mirrored by a CSS transform. */
export function flippedBetween(el: HTMLElement, stop: HTMLElement, rules: readonly Rule[]): boolean {
  let flips = 0
  for (let cur: HTMLElement | null = el; cur && isElement(cur); cur = cur === stop ? null : (cur.parentNode as HTMLElement | null)) {
    if (FLIPPING.test(declsOf(cur, rules))) flips++
  }
  return flips % 2 === 1
}

const INLINE_TAGS = new Set(['span', 'bdi', 'bdo', 'a', 'b', 'strong', 'i', 'em', 'small', 'time', 'mark', 'u', 's', 'abbr', 'cite', 'code', 'label', 'sup', 'sub', 'q', 'font'])

// Utility classes (Tailwind and the like) that set display without any rule in the page's own style tags.
const CLASS_DISPLAY: Readonly<Record<string, string>> = {
  flex: 'flex',
  'inline-flex': 'inline-flex',
  grid: 'grid',
  'inline-grid': 'inline-grid',
  block: 'block',
  'inline-block': 'inline-block',
  inline: 'inline',
  hidden: 'none',
  contents: 'contents',
  table: 'table',
}

function displayOf(el: HTMLElement, rules: readonly Rule[]): string {
  const all = [...declsOf(el, rules).matchAll(/(?:^|;)\s*display\s*:\s*([a-z-]+)/gi)]
  if (all.length > 0) return all[all.length - 1]![1]!.toLowerCase()
  const fromClass = (el.getAttribute('class') ?? '').split(/\s+/).map((c) => CLASS_DISPLAY[c]).filter((d) => d !== undefined)
  return fromClass[fromClass.length - 1] ?? (INLINE_TAGS.has(tagOf(el)) ? 'inline' : 'block')
}

export const isInline = (el: HTMLElement, rules: readonly Rule[]) => displayOf(el, rules) === 'inline'
const isFlexLike = (el: HTMLElement, rules: readonly Rule[]) => /flex|grid/.test(displayOf(el, rules))

type Piece = { readonly node: TextNode; readonly text: string }

/** Text runs in one inline flow, split wherever a block box or line break interrupts it. */
function segmentsOf(container: HTMLElement, rules: readonly Rule[]): readonly (readonly Piece[])[] {
  const segments: Piece[][] = [[]]
  const visit = (parent: HTMLElement) => {
    for (const child of parent.childNodes) {
      if (isText(child)) segments[segments.length - 1]!.push({ node: child, text: child.rawText })
      else if (isElement(child) && tagOf(child) !== 'br' && isInline(child, rules)) visit(child)
      else segments.push([])
    }
  }
  visit(container)
  return segments
}

/**
 * The inline flow that holds el: its nearest non-inline ancestor and the text runs laid out with it.
 * Null when el is a flex or grid item, which is not part of any text flow.
 */
export function flowOf(el: HTMLElement, rules: readonly Rule[]): { container: HTMLElement; segments: readonly (readonly Piece[])[] } | null {
  let cur = el
  while (isInline(cur, rules)) {
    const parent = cur.parentNode as HTMLElement | null
    if (!parent || !isElement(parent)) return null
    cur = parent
  }
  if (isFlexLike(cur, rules) && cur !== el) return null
  return { container: cur, segments: segmentsOf(cur, rules) }
}

/** Text that comes before position `at` of a text node, in the same flow. */
export function textBefore(el: HTMLElement, node: TextNode, at: number, rules: readonly Rule[]): string {
  const flow = flowOf(el, rules)
  // In a flex or grid container every child is its own item, so only the run itself is one flow.
  if (flow && isFlexLike(flow.container, rules)) return node.rawText.slice(0, at)
  const seg = flow?.segments.find((s) => s.some((p) => p.node === node))
  if (!seg) return ''
  const idx = seg.findIndex((p) => p.node === node)
  return seg.slice(0, idx).map((p) => p.text).join('') + node.rawText.slice(0, at)
}

const within = (node: TextNode, el: HTMLElement) => {
  for (let cur: unknown = node.parentNode; cur; cur = (cur as HTMLElement).parentNode) if (cur === el) return true
  return false
}

/** Text in the same flow as el but outside it. Empty when el is not part of a text flow. */
export function textAround(el: HTMLElement, rules: readonly Rule[]): string {
  const flow = isInline(el, rules) ? flowOf(el, rules) : null
  const seg = flow?.segments.find((s) => s.some((p) => within(p.node, el)))
  return (seg ?? []).filter((p) => !within(p.node, el)).map((p) => p.text).join('')
}
