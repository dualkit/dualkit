import { VISITOR_KEYS, type Expression, type Node, type ObjectExpression } from '@babel/types'
import type { DefaultTreeAdapterMap } from 'parse5'
import type { SourceFile } from './types'

type HtmlNode = DefaultTreeAdapterMap['node']
type Element = DefaultTreeAdapterMap['element']

/**
 * A statically known piece of a class list. offset is where text starts in SourceFile.text.
 * group is shared by every fragment of one class source: one JSX attribute value, one top-level class
 * call with all its arguments, one HTML class attribute or one @apply.
 */
export type ClassFragment = { offset: number; text: string; group: number }

/** Calls whose string arguments are class lists. cva and tv also take a config object, read by configClasses. */
const CLASS_CALLS = new Set(['clsx', 'cn', 'cx', 'twMerge', 'twJoin', 'classnames', 'classNames'])
const VARIANT_CALLS = new Set(['cva', 'tv'])
const CLASS_ATTRS = new Set(['className', 'class'])
/** Keys in a compoundVariants or compoundSlots entry whose value is a class list. The other keys select variants. */
const COMPOUND_CLASS_KEYS = new Set(['class', 'className'])

const SPACE = /\s/

type Out = { map: Map<number, ClassFragment>; groups: number }
type Sink = { file: SourceFile; base: number; out: Out; group: number }

const nextGroup = (out: Out): number => ++out.groups

/**
 * Adds the text between start and end. A side marked cut touches dynamic code, so a token
 * running into that side is only part of a class and is dropped rather than guessed.
 */
function emit(sink: Sink, start: number, end: number, cutStart: boolean, cutEnd: boolean): void {
  const { text } = sink.file
  let from = sink.base + start
  let to = sink.base + end
  if (cutStart) while (from < to && !SPACE.test(text[from]!)) from++
  if (cutEnd) while (to > from && !SPACE.test(text[to - 1]!)) to--
  if (to > from && !sink.out.map.has(from)) sink.out.map.set(from, { offset: from, text: text.slice(from, to), group: sink.group })
}

/** A string literal's content, without its quotes. */
function literal(sink: Sink, node: Node, cutStart = false, cutEnd = false): void {
  if (node.start == null || node.end == null) return
  emit(sink, node.start + 1, node.end - 1, cutStart, cutEnd)
}

const calleeName = (node: Node): string | null => {
  if (node.type !== 'CallExpression') return null
  return node.callee.type === 'Identifier' ? node.callee.name : null
}

/** Reads an expression whose value is used as a class list. */
function classExpr(sink: Sink, node: Node | null | undefined, cutStart = false, cutEnd = false): void {
  if (!node) return
  switch (node.type) {
    case 'StringLiteral':
      return literal(sink, node, cutStart, cutEnd)
    case 'TemplateLiteral':
      node.quasis.forEach((q, i) => {
        if (q.start == null || q.end == null) return
        emit(sink, q.start, q.end, cutStart || i > 0, cutEnd || i < node.quasis.length - 1)
      })
      node.expressions.forEach((e, i) => {
        // `p-1 ${on ? 'ml-2' : ''} x` holds whole classes; `ml-${on ? '2' : '4'}` does not.
        const before = node.quasis[i]!.value.raw
        const after = node.quasis[i + 1]!.value.raw
        const cutBefore = before === '' ? i > 0 || cutStart : !SPACE.test(before.at(-1)!)
        const cutAfter = after === '' ? i + 1 < node.quasis.length - 1 || cutEnd : !SPACE.test(after[0]!)
        classExpr(sink, e, cutBefore, cutAfter)
      })
      return
    case 'BinaryExpression':
      if (node.operator !== '+') return
      classExpr(sink, node.left, cutStart, true)
      return classExpr(sink, node.right, true, cutEnd)
    case 'ConditionalExpression':
      classExpr(sink, node.consequent, cutStart, cutEnd)
      return classExpr(sink, node.alternate, cutStart, cutEnd)
    case 'LogicalExpression':
      if (node.operator !== '&&') classExpr(sink, node.left, cutStart, cutEnd)
      return classExpr(sink, node.right, cutStart, cutEnd)
    case 'ArrayExpression':
      for (const el of node.elements) if (el && el.type !== 'SpreadElement') classExpr(sink, el)
      return
    case 'ObjectExpression':
      return objectKeys(sink, node)
    case 'ParenthesizedExpression':
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
      return classExpr(sink, node.expression, cutStart, cutEnd)
    case 'CallExpression':
      return classCall(sink, node)
    default:
      return
  }
}

/** clsx({ 'pl-4': active }): the keys are classes, the values are conditions. */
function objectKeys(sink: Sink, node: ObjectExpression): void {
  for (const prop of node.properties) {
    if (prop.type !== 'ObjectProperty' && prop.type !== 'ObjectMethod') continue
    const key = prop.key
    if (key.type === 'StringLiteral' && !prop.computed) literal(sink, key)
    else if (key.type === 'Identifier' && !prop.computed && key.start != null && key.end != null) emit(sink, key.start, key.end, false, false)
    else if (key.type === 'TemplateLiteral' && prop.computed) classExpr(sink, key)
  }
}

const propName = (prop: Node): string | null => {
  if (prop.type !== 'ObjectProperty' || prop.computed) return null
  if (prop.key.type === 'Identifier') return prop.key.name
  return prop.key.type === 'StringLiteral' ? prop.key.value : null
}

/** Every leaf value under an object is a class list: variants, slots, and tv's per-slot variant values. */
function leafValues(sink: Sink, node: Node): void {
  if (node.type !== 'ObjectExpression') return classExpr(sink, node)
  for (const prop of node.properties) if (prop.type === 'ObjectProperty') leafValues(sink, prop.value)
}

/** compoundVariants and compoundSlots: only the class or className value is a class list. */
function compoundEntries(sink: Sink, node: Node): void {
  if (node.type !== 'ArrayExpression') return
  for (const entry of node.elements) {
    if (entry?.type !== 'ObjectExpression') continue
    for (const prop of entry.properties) {
      if (prop.type === 'ObjectProperty' && COMPOUND_CLASS_KEYS.has(propName(prop) ?? '')) leafValues(sink, prop.value)
    }
  }
}

/** A cva or tv config object. defaultVariants holds variant names, not classes, so it is not read. */
function configClasses(sink: Sink, node: Node): void {
  if (node.type !== 'ObjectExpression') return
  for (const prop of node.properties) {
    if (prop.type !== 'ObjectProperty') continue
    const name = propName(prop)
    if (name === 'base') classExpr(sink, prop.value)
    else if (name === 'slots' || name === 'variants') leafValues(sink, prop.value)
    else if (name === 'compoundVariants' || name === 'compoundSlots') compoundEntries(sink, prop.value)
  }
}

function classCall(sink: Sink, node: Node): void {
  const name = calleeName(node)
  if (!name || node.type !== 'CallExpression') return
  if (CLASS_CALLS.has(name)) {
    for (const arg of node.arguments) if (arg.type !== 'SpreadElement' && arg.type !== 'ArgumentPlaceholder') classExpr(sink, arg)
    return
  }
  if (!VARIANT_CALLS.has(name)) return
  const [first, second] = node.arguments
  // cva(base, config); tv(config).
  if (first?.type === 'ObjectExpression') configClasses(sink, first)
  else if (first) classExpr(sink, first)
  if (second) configClasses(sink, second)
}

const SKIP_KEYS = new Set(['loc', 'leadingComments', 'trailingComments', 'innerComments', 'extra'])

function visit(sink: Sink, node: Node): void {
  if (node.type === 'JSXAttribute' && node.name.type === 'JSXIdentifier' && CLASS_ATTRS.has(node.name.name)) {
    const value = node.value
    const attr = { ...sink, group: nextGroup(sink.out) }
    if (value?.type === 'StringLiteral') literal(attr, value)
    else if (value?.type === 'JSXExpressionContainer' && value.expression.type !== 'JSXEmptyExpression') classExpr(attr, value.expression as Expression)
  } else if (node.type === 'CallExpression') {
    // A call already read as part of an outer source keeps that source's group: its offsets are taken.
    classCall({ ...sink, group: nextGroup(sink.out) }, node)
  }
  for (const key of VISITOR_KEYS[node.type] ?? []) {
    if (SKIP_KEYS.has(key)) continue
    const child = (node as unknown as Record<string, unknown>)[key]
    if (Array.isArray(child)) {
      for (const c of child) if (c && typeof c === 'object' && 'type' in c) visit(sink, c as Node)
    } else if (child && typeof child === 'object' && 'type' in child) {
      visit(sink, child as Node)
    }
  }
}

function* elements(node: HtmlNode): Generator<Element> {
  if ('tagName' in node) yield node
  if ('childNodes' in node) for (const child of node.childNodes) yield* elements(child)
  if ('content' in node) yield* elements(node.content)
}

const QUOTED_VALUE = /^[^=]*=\s*(["']?)/

function htmlClasses(file: SourceFile, out: Out): void {
  if (!file.html) return
  for (const el of elements(file.html)) {
    const loc = el.sourceCodeLocation?.attrs?.class
    if (!loc) continue
    const raw = file.text.slice(loc.startOffset, loc.endOffset)
    const head = QUOTED_VALUE.exec(raw)
    if (!head) continue
    const start = loc.startOffset + head[0].length
    const end = loc.endOffset - (head[1] ? 1 : 0)
    if (end > start) out.map.set(start, { offset: start, text: file.text.slice(start, end), group: nextGroup(out) })
  }
}

function applyClasses(file: SourceFile, out: Out): void {
  for (const block of file.css) {
    block.root.walkAtRules((rule) => {
      const start = rule.source?.start?.offset
      if (rule.name.toLowerCase() !== 'apply' || start === undefined || !rule.params) return
      const offset = block.offset + start + 1 + rule.name.length + (rule.raws.afterName?.length ?? 0)
      if (file.text.startsWith(rule.params, offset)) out.map.set(offset, { offset, text: rule.params, group: nextGroup(out) })
    })
  }
}

/** Every statically known class-list fragment in the file, in file order. Other strings and comments are never read. */
export function classStrings(file: SourceFile): ClassFragment[] {
  const out: Out = { map: new Map(), groups: 0 }
  htmlClasses(file, out)
  for (const block of file.js) visit({ file, base: block.offset, out, group: 0 }, block.ast.program)
  applyClasses(file, out)
  return [...out.map.values()].sort((a, b) => a.offset - b.offset)
}
