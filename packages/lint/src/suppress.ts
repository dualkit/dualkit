import type { DefaultTreeAdapterMap } from 'parse5'
import { lineStarts, positionAt } from './position'
import type { SourceFile } from './types'

type Node = DefaultTreeAdapterMap['node']

/** A comment's text and where it ends in SourceFile.text. */
type Comment = { value: string; end: number }

/** Rules turned off per line, and for the whole file. ALL means every rule. */
type Directives = { lines: Map<number, Set<string>>; file: Set<string> }

const ALL = '*'
const cache = new WeakMap<SourceFile, Directives>()

function* htmlComments(node: Node): Generator<Comment> {
  if (node.nodeName === '#comment' && 'data' in node && node.sourceCodeLocation) {
    yield { value: node.data, end: node.sourceCodeLocation.endOffset }
  }
  if ('childNodes' in node) for (const child of node.childNodes) yield* htmlComments(child)
  if ('content' in node) yield* htmlComments(node.content)
}

/** Comments from the parsers only, so text in a string or attribute that looks like a comment never counts. */
function* comments(file: SourceFile): Generator<Comment> {
  for (const block of file.js) {
    for (const c of block.ast.comments ?? []) if (typeof c.end === 'number') yield { value: c.value, end: block.offset + c.end }
  }
  for (const block of file.css) {
    const nodes: Comment[] = []
    block.root.walkComments((c) => {
      // postcss gives an exclusive end offset; an SCSS // comment would print as /* */, so its printed length is not used.
      const end = c.source?.end?.offset
      if (typeof end === 'number') nodes.push({ value: c.text, end: block.offset + end })
    })
    yield* nodes
  }
  if (file.html) yield* htmlComments(file.html)
}

/** Reads `dualkit-disable-next-line ids` or `dualkit-disable ids`, with an optional `-- reason`. */
export function parseDirective(value: string): { kind: 'next-line' | 'file'; rules: string[] } | null {
  const body = value.replace(/^[\s*]+/, '').split(/\s--\s/)[0]?.trim() ?? ''
  const match = /^dualkit-(disable-next-line|disable)(?:\s+([\s\S]*))?$/.exec(body)
  if (!match) return null
  const rules = (match[2] ?? '').split(/[\s,]+/).filter(Boolean)
  return { kind: match[1] === 'disable' ? 'file' : 'next-line', rules: rules.length ? rules : [ALL] }
}

function directives(file: SourceFile): Directives {
  const hit = cache.get(file)
  if (hit) return hit
  const starts = lineStarts(file.text)
  const found: Directives = { lines: new Map(), file: new Set() }
  for (const c of comments(file)) {
    const d = parseDirective(c.value)
    if (!d) continue
    if (d.kind === 'file') {
      for (const r of d.rules) found.file.add(r)
      continue
    }
    const line = positionAt(starts, Math.max(0, c.end - 1)).line + 1
    const set = found.lines.get(line) ?? new Set<string>()
    for (const r of d.rules) set.add(r)
    found.lines.set(line, set)
  }
  cache.set(file, found)
  return found
}

/** True when a comment turns this rule off on this 1-based line, or for the whole file. */
export function suppressed(file: SourceFile, rule: string, line: number): boolean {
  const d = directives(file)
  if (d.file.has(ALL) || d.file.has(rule)) return true
  const set = d.lines.get(line)
  return set !== undefined && (set.has(ALL) || set.has(rule))
}
