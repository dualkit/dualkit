import { VISITOR_KEYS, type Node } from '@babel/types'

/** Calls fn for node and every node below it, with the parent. Comments are never visited. */
export function visit(node: Node, fn: (node: Node, parent: Node | null) => void, parent: Node | null = null): void {
  fn(node, parent)
  for (const key of VISITOR_KEYS[node.type] ?? []) {
    const child = (node as unknown as Record<string, unknown>)[key]
    if (Array.isArray(child)) {
      for (const c of child) if (c && typeof c === 'object' && 'type' in c) visit(c as Node, fn, node)
    } else if (child && typeof child === 'object' && 'type' in child) {
      visit(child as Node, fn, node)
    }
  }
}

/** Looks through parentheses and TypeScript wrappers that do not change the value. */
export function unwrap(node: Node | null | undefined): Node | null {
  let current = node ?? null
  while (current && (current.type === 'ParenthesizedExpression' || current.type === 'TSAsExpression' || current.type === 'TSSatisfiesExpression' || current.type === 'TSNonNullExpression' || current.type === 'TSTypeAssertion')) {
    current = current.expression
  }
  return current
}

/** The value of a string literal or a template without expressions, else null. */
export function staticString(node: Node | null | undefined): string | null {
  const n = unwrap(node)
  if (!n) return null
  if (n.type === 'StringLiteral') return n.value
  if (n.type === 'TemplateLiteral' && n.expressions.length === 0 && n.quasis.length === 1) return n.quasis[0]!.value.cooked ?? null
  return null
}

/** A locale argument as a list: one static string, or an array of static strings. Anything else is null. */
export function staticLocales(node: Node | null | undefined): string[] | null {
  const n = unwrap(node)
  if (!n) return null
  if (n.type === 'ArrayExpression') {
    const out: string[] = []
    for (const el of n.elements) {
      const s = el && el.type !== 'SpreadElement' ? staticString(el) : null
      if (s === null) return null
      out.push(s)
    }
    return out
  }
  const s = staticString(n)
  return s === null ? null : [s]
}

/** The properties of an object literal by key. Null for anything else, and for any spread, computed key, method or accessor. */
export function staticObject(node: Node | null | undefined): Map<string, Node> | null {
  const n = unwrap(node)
  if (!n || n.type !== 'ObjectExpression') return null
  const out = new Map<string, Node>()
  for (const prop of n.properties) {
    if (prop.type !== 'ObjectProperty' || prop.computed) return null
    const key = prop.key.type === 'Identifier' ? prop.key.name : prop.key.type === 'StringLiteral' ? prop.key.value : null
    if (key === null) return null
    out.set(key, prop.value)
  }
  return out
}
