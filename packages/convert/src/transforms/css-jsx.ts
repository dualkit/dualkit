import { parseSource, physicalDeclarations, liveDeclarations, type LiveDeclaration, type SourceFile } from '@dualkit/lint'
import type { Edit, FileResult, Flag } from '../types'
import { noLogicalForm, splitShorthand } from './css-values'
import { lineOf } from './lines'

type Node = { type?: string; start?: number; end?: number; name?: string; value?: unknown; [key: string]: unknown }
const SKIP = new Set(['loc', 'leadingComments', 'trailingComments', 'innerComments', 'extra'])

function* styleObjects(node: unknown): Generator<Node> {
  if (Array.isArray(node)) for (const child of node) yield* styleObjects(child)
  if (!node || typeof node !== 'object' || Array.isArray(node)) return
  const n = node as Node & { name?: { name?: string }; value?: Node }
  if (n.type === 'JSXAttribute' && n.name?.name === 'style') {
    const expression = n.value?.type === 'JSXExpressionContainer' ? (n.value.expression as Node | undefined) : undefined
    if (expression?.type === 'ObjectExpression') yield expression
    return
  }
  for (const [key, child] of Object.entries(n)) if (!SKIP.has(key)) yield* styleObjects(child)
}

const kebab = (name: string): string => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
const camel = (name: string): string => name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())

/** One static property of a style object, with where its key, value and whole text sit in the file. */
type Entry = {
  prop: string
  value: string
  key: { start: number; end: number; quote: string }
  literal: { start: number; end: number; quote: string } | null
  whole: { start: number; end: number }
}

const span = (n: Node, base: number) => ({ start: base + n.start!, end: base + n.end! })

/** The key's name and place, or null when it is computed or not a plain camelCase name. */
function keyOf(property: Node, base: number): Entry['key'] & { name: string } | null {
  const key = property.key as Node
  if (property.computed || (key.type !== 'Identifier' && key.type !== 'StringLiteral')) return null
  const name = key.type === 'Identifier' ? key.name! : String(key.value)
  if (!/^[a-z][A-Za-z]*$/.test(name)) return null
  return { name, ...span(key, base), quote: key.type === 'StringLiteral' ? 'x' : '' }
}

function entryOf(property: Node, base: number, text: string, dynamic: (source: string) => string): Entry | null {
  if (property.type !== 'ObjectProperty') return null
  const key = keyOf(property, base)
  if (!key) return null
  const value = property.value as Node
  const at = span(value, base)
  const quote = text[at.start]!
  const literal = value.type === 'StringLiteral' ? { ...at, quote } : null
  const written =
    value.type === 'StringLiteral' ? String(value.value)
    : value.type === 'NumericLiteral' ? `${String(value.value)}px`
    : dynamic(text.slice(at.start, at.end))
  return {
    prop: kebab(key.name), value: written.replace(/\s+/g, ' '),
    key: { start: key.start, end: key.end, quote: key.quote ? text[key.start]! : '' }, literal, whole: span(property, base),
  }
}

const requote = (quote: string, inner: string): string => `${quote}${inner}${quote}`

function edits(entry: Entry, live: LiveDeclaration, physical: { property: string | null; word: string | null } | null): Edit[] {
  const split = splitShorthand(live.prop, entry.value, live.value)
  if (split && entry.literal) {
    const q = entry.literal.quote
    const text = `${camel(split.property)}Block: ${requote(q, split.block)}, ${camel(split.property)}Inline: ${requote(q, split.inline)}`
    return [{ ...entry.whole, text }]
  }
  if (physical?.property) return [{ start: entry.key.start, end: entry.key.end, text: requote(entry.key.quote, camel(physical.property)) }]
  if (physical?.word && entry.literal) return [{ start: entry.literal.start, end: entry.literal.end, text: requote(entry.literal.quote, physical.word) }]
  return []
}

/**
 * Reads each JSX `style={{ ... }}` object as CSS: its static properties become declarations, the same
 * decisions lint makes are applied, and the results map back to the object's own text.
 */
export function jsxStyleResult(file: SourceFile): FileResult {
  const editsOut: Edit[] = []
  const flags: Flag[] = []
  for (const block of file.js) {
    for (const object of styleObjects(block.ast.program)) {
      const ids = new Map<string, string>()
      const dynamic = (source: string): string => {
        if (!ids.has(source)) ids.set(source, `$${'x'.repeat(ids.size + 1)}`)
        return ids.get(source)!
      }
      const entries = ((object.properties as Node[]) ?? [])
        .map((p) => entryOf(p, block.offset, file.text, dynamic))
        .filter((e): e is Entry => e !== null)
      const css = entries.map((e) => `${e.prop}: ${e.value};\n`).join('')
      const starts: number[] = []
      entries.reduce((at, e) => (starts.push(at), at + e.prop.length + e.value.length + 4), 0)
      const synthetic = parseSource('style-object.css', css)
      if (!synthetic) continue
      const entryAt = (offset: number): Entry | undefined => entries[starts.indexOf(offset)]
      const physical = new Map(physicalDeclarations(synthetic).map((d) => [d.offset, d]))
      for (const live of liveDeclarations(synthetic)) {
        const entry = entryAt(live.offset)
        if (!entry) continue
        editsOut.push(...edits(entry, live, physical.get(live.offset) ?? null))
        const suggestion = noLogicalForm(live)
        if (suggestion) {
          const message = `\`${entry.prop}: ${live.shown}\` has no logical form in CSS and stays physical in Arabic.`
          flags.push({ file: file.path, line: lineOf(file.text, entry.whole.start), kind: 'no-logical-form', message, suggestion })
        }
      }
    }
  }
  return { edits: editsOut, flags }
}
