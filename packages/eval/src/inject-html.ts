import { HTMLElement, NodeType, parse, type Node, type TextNode } from 'node-html-parser'

/** One splice into the original source: replace [start, end) with text. */
export type Edit = { readonly start: number; readonly end: number; readonly text: string }

export const ARABIC = /[؀-ۿ]/
const SKIPPED_TAGS = new Set(['script', 'style', 'noscript', 'template', 'head', 'title', 'svg', 'textarea'])
const ATTR = (name: string) => new RegExp(`\\s+${name}(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?(?=[\\s/>])`, 'gi')

export function isElement(n: Node): n is HTMLElement {
  return n.nodeType === NodeType.ELEMENT_NODE
}

export function isText(n: Node): n is TextNode {
  return n.nodeType === NodeType.TEXT_NODE
}

/** Parse a page and return its body, or the whole tree for a fragment. */
export function bodyOf(html: string): HTMLElement {
  const root = parse(html)
  return root.querySelector('body') ?? root
}

/** Every visible element under root in document order. Script, style, head and svg internals are left out. */
export function elementsOf(root: HTMLElement): readonly HTMLElement[] {
  const out: HTMLElement[] = []
  const visit = (el: HTMLElement) => {
    for (const child of el.childNodes) {
      if (!isElement(child) || SKIPPED_TAGS.has(child.rawTagName?.toLowerCase() ?? '')) continue
      out.push(child)
      visit(child)
    }
  }
  visit(root)
  return out
}

export function tagOf(el: HTMLElement): string {
  return (el.rawTagName ?? '').toLowerCase()
}

/** Direct text children that carry something other than whitespace. */
export function ownTexts(el: HTMLElement): readonly TextNode[] {
  return el.childNodes.filter(isText).filter((t) => t.rawText.trim() !== '')
}

export function hasElementChild(el: HTMLElement): boolean {
  return el.childNodes.some(isElement)
}

/** Index just after the `>` that closes the opening tag starting at start. Quote aware. */
export function openTagEnd(html: string, start: number): number {
  let quote = ''
  for (let i = start; i < html.length; i++) {
    const c = html[i]!
    if (quote) {
      if (c === quote) quote = ''
    } else if (c === '"' || c === "'") quote = c
    else if (c === '>') return i + 1
  }
  return html.length
}

export function applyEdits(html: string, edits: readonly Edit[]): string {
  return [...edits]
    .sort((a, b) => b.start - a.start)
    .reduce((acc, e) => acc.slice(0, e.start) + e.text + acc.slice(e.end), html)
}

export function removeAttr(rest: string, name: string): string {
  return rest.replace(ATTR(name), '')
}

/** Put extra attribute text just before the closing `>` or `/>` of an opening tag remainder. */
export function appendAttrs(rest: string, attrs: string): string {
  return rest.replace(/\s*\/?>$/, (end) => `${attrs}${end}`)
}

/** Add declarations to an inline style, creating the attribute when there is none. */
export function addStyle(rest: string, decls: string): string {
  const quoted = /(\sstyle\s*=\s*)(["'])(.*?)\2/is.exec(rest)
  if (!quoted) return appendAttrs(rest, ` style="${decls}"`)
  const body = quoted[3]!.trim().replace(/;?$/, ';')
  return rest.replace(quoted[0], `${quoted[1]}${quoted[2]}${body} ${decls}${quoted[2]}`)
}

/** Drop one declaration from an inline style value. */
export function removeStyleDecl(rest: string, prop: string): string {
  return rest.replace(/(\sstyle\s*=\s*)(["'])(.*?)\2/is, (_m, eq: string, q: string, body: string) => {
    const kept = body.split(';').filter((d) => d.trim() !== '' && d.split(':')[0]!.trim().toLowerCase() !== prop)
    return kept.length === 0 ? '' : `${eq}${q}${kept.join(';')}${q}`
  })
}

export type Retag = {
  readonly tag?: string
  readonly transform?: (rest: string) => string
}

/**
 * Edits that rewrite an element's opening tag, with data-eval-bug as its first attribute.
 * Renaming also rewrites the closing tag.
 */
export function retag(html: string, el: HTMLElement, kind: string, opts: Retag = {}): readonly Edit[] {
  const [start, end] = el.range
  const name = el.rawTagName ?? ''
  const openEnd = openTagEnd(html, start)
  const rest = html.slice(start + 1 + name.length, openEnd)
  const next = opts.tag ?? name
  const opening: Edit = {
    start,
    end: openEnd,
    text: `<${next} data-eval-bug="${kind}"${(opts.transform ?? ((r) => r))(rest)}`,
  }
  if (next === name) return [opening]
  const closing = `</${name}>`
  const hasClosing = html.slice(end - closing.length, end).toLowerCase() === closing
  return hasClosing ? [opening, { start: end - closing.length, end, text: `</${next}>` }] : [opening]
}

export function textEdit(t: TextNode, text: string): Edit {
  return { start: t.range[0], end: t.range[1], text }
}
