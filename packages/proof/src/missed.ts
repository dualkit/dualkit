import { parse } from '@babel/parser'
import type { Node } from '@babel/types'

/** One English string still sitting in source after convert ran. */
export type Missed = { text: string; line: number }

const TEXT_ATTRS = new Set(['alt', 'aria-label', 'description', 'label', 'placeholder', 'subtitle', 'title'])
const TEXT_KEYS = new Set(['alt', 'description', 'label', 'message', 'name', 'placeholder', 'subtitle', 'text', 'title'])
const TEXT_DEFAULTS = /^(children|description|label|message|placeholder|subtitle|text|title)$/

/** A human phrase: has a word of letters, and is not a path, identifier or class list. */
export const isEnglish = (value: string): boolean => {
  const text = value.trim()
  if (!/[A-Za-z]{2,}/.test(text) || /[؀-ۿ]/.test(text)) return false
  if (/^[/.#@]|:\/\/|[_{}<>=]/.test(text)) return false
  if (text.split(/\s+/).some((word) => /^[a-z]+(-[a-z0-9]+)+$|^[a-z]+:[a-z-]+/.test(word)) && !/[A-Z]/.test(text)) return false
  return /\s/.test(text) || /^[A-Z][a-z]+$/.test(text)
}

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string'

const stringsIn = (node: Node | null | undefined): Node[] => {
  if (!node) return []
  if (node.type === 'StringLiteral') return [node]
  if (node.type === 'ConditionalExpression') return [...stringsIn(node.consequent), ...stringsIn(node.alternate)]
  if (node.type === 'LogicalExpression') return stringsIn(node.right)
  if (node.type === 'JSXExpressionContainer') return stringsIn(node.expression as Node)
  return []
}

const keyName = (node: Node): string | null =>
  node.type === 'Identifier' ? node.name : node.type === 'StringLiteral' ? node.value : null

/** The nodes one syntax node contributes as user-facing text. */
function candidates(node: Node): Node[] {
  if (node.type === 'JSXText') return [node]
  if (node.type === 'JSXExpressionContainer') return stringsIn(node)
  if (node.type === 'JSXAttribute') {
    const name = node.name.type === 'JSXIdentifier' ? node.name.name : ''
    return TEXT_ATTRS.has(name) ? stringsIn(node.value) : []
  }
  if (node.type === 'ObjectProperty') {
    const key = keyName(node.key)
    return key !== null && TEXT_KEYS.has(key) ? stringsIn(node.value as Node) : []
  }
  if (node.type === 'AssignmentPattern' && node.left.type === 'Identifier' && TEXT_DEFAULTS.test(node.left.name)) {
    return stringsIn(node.right)
  }
  return []
}

const valueOf = (node: Node): string => (node.type === 'JSXText' || node.type === 'StringLiteral' ? node.value : '')

function walk(node: Node, visit: (n: Node) => void): void {
  visit(node)
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.filter(isNode).forEach((child) => walk(child, visit))
    else if (isNode(value)) walk(value, visit)
  }
}

/**
 * Finds English left in one source file. This scanner shares no code with convert on purpose, so it can
 * count what convert misses. It is a floor: it cannot see strings built at run time.
 */
export function findEnglish(code: string, file: string): Missed[] {
  let ast: Node
  try {
    ast = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'], sourceFilename: file }) as unknown as Node
  } catch {
    return []
  }
  const seen = new Set<Node>()
  const found: Missed[] = []
  walk(ast, (node) => {
    for (const hit of candidates(node)) {
      if (seen.has(hit)) continue
      seen.add(hit)
      const text = valueOf(hit).trim().replace(/\s+/g, ' ')
      if (isEnglish(text)) found.push({ text, line: hit.loc?.start.line ?? 0 })
    }
  })
  return found
}
