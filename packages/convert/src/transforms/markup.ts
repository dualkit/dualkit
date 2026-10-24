import type { SourceFile } from '@dualkit/lint'
import type { Edit, FileResult, Flag } from '../types'
import { lineOf } from './lines'

type Node = { type?: string; start?: number; end?: number; name?: unknown; [key: string]: unknown }
const SKIP = new Set(['loc', 'leadingComments', 'trailingComments', 'innerComments', 'extra'])

const ICON_SOURCES = ['lucide-react', '@radix-ui/react-icons', '@tabler/icons-react', '@phosphor-icons/react']
const ICON_PREFIXES = ['@heroicons/react/', 'react-icons/']
const MIRROR_ICON = /(Arrow|Chevron|Chevrons|Caret|Angle|Triangle)(Left|Right)|ArrowBack|ArrowForward|Undo|Redo|Reply|Forward|Send|LogIn|LogOut|SignIn|SignOut|Indent|Outdent/
const NEVER_MIRROR = /Play|Pause|FastForward|Rewind|Skip|Clock|Timer|Check|Music|Logo|Brand|Github|Twitter|X$/
const NUMBER_NAME = /(price|amount|total|subtotal|cost|fee|balance|phone|mobile|tel|qty|quantity|count)$/i
const NUMBER_CALL = /^(toLocaleString|toFixed|format.*)$/
const DIRECTION_LABEL = /\b(back|prev|previous|next|forward)\b/i
const LTR_TYPES = new Set(['tel', 'email', 'url'])

const isIconSource = (source: string): boolean => ICON_SOURCES.includes(source) || ICON_PREFIXES.some((p) => source.startsWith(p))

/** Local name to imported name for every icon import. */
function iconImports(program: Node): Map<string, string> {
  const found = new Map<string, string>()
  for (const statement of (program.body as Node[]) ?? []) {
    if (statement.type !== 'ImportDeclaration' || !isIconSource(String((statement.source as Node).value))) continue
    for (const spec of (statement.specifiers as Node[]) ?? []) {
      const local = (spec.local as Node).name as string
      const imported = spec.type === 'ImportSpecifier' ? ((spec.imported as Node).name ?? (spec.imported as Node).value) : local
      found.set(local, String(imported))
    }
  }
  return found
}

const isMirrored = (imported: string): boolean => MIRROR_ICON.test(imported) && !NEVER_MIRROR.test(imported)

const tagName = (opening: Node): string | null => {
  const name = opening.name as Node
  return name.type === 'JSXIdentifier' ? (name.name as string) : null
}

const attributes = (opening: Node): Node[] => ((opening.attributes as Node[]) ?? []).filter((a) => a.type === 'JSXAttribute')
const attributeNamed = (opening: Node, name: string): Node | undefined => attributes(opening).find((a) => (a.name as Node).name === name)

/** The string an attribute holds, when it is a plain literal. */
function literalValue(attribute: Node | undefined): string | null {
  const value = attribute?.value as Node | undefined
  if (value?.type === 'StringLiteral') return String(value.value)
  const inner = value?.type === 'JSXExpressionContainer' ? (value.expression as Node) : undefined
  return inner?.type === 'StringLiteral' ? String(inner.value) : null
}

/** The last name of an identifier or member chain, or null. */
function lastName(expression: Node): string | null {
  if (expression.type === 'Identifier') return expression.name as string
  if (expression.type === 'MemberExpression' || expression.type === 'OptionalMemberExpression') {
    const property = expression.property as Node
    return !expression.computed && property.type === 'Identifier' ? (property.name as string) : null
  }
  return null
}

function isNumberExpression(expression: Node): boolean {
  if (expression.type === 'CallExpression' || expression.type === 'OptionalCallExpression') {
    const name = lastName(expression.callee as Node)
    return name !== null && NUMBER_CALL.test(name)
  }
  const name = lastName(expression)
  return name !== null && NUMBER_NAME.test(name)
}

/** The text a button or link shows, with its aria-label and title. */
function labelOf(element: Node): string {
  const opening = element.openingElement as Node
  const own = [literalValue(attributeNamed(opening, 'aria-label')), literalValue(attributeNamed(opening, 'title'))]
  const text = ((element.children as Node[]) ?? []).filter((c) => c.type === 'JSXText').map((c) => String(c.value))
  return [...own, ...text].filter(Boolean).join(' ')
}

type Context = { file: SourceFile; base: number; icons: Map<string, string>; edits: Edit[]; flags: Flag[] }

function visitOpening(opening: Node, ctx: Context, ancestors: Node[]): void {
  const name = tagName(opening)
  if (!name) return
  const after = ctx.base + (opening.name as Node).end!
  if (ctx.icons.has(name) && isMirrored(ctx.icons.get(name)!) && !attributeNamed(opening, 'data-dk-mirror')) {
    ctx.edits.push({ start: after, end: after, text: ' data-dk-mirror=""' })
  }
  if (name === 'input' && LTR_TYPES.has(literalValue(attributeNamed(opening, 'type')) ?? '') && !attributeNamed(opening, 'dir')) {
    ctx.edits.push({ start: after, end: after, text: ' dir="ltr"' })
  }
  if (name === 'svg') flagSvg(opening, ctx, ancestors)
}

function flagSvg(opening: Node, ctx: Context, ancestors: Node[]): void {
  const control = [...ancestors].reverse().find((a) => a.type === 'JSXElement' && ['button', 'a'].includes(tagName(a.openingElement as Node) ?? ''))
  if (!control || !DIRECTION_LABEL.test(labelOf(control))) return
  ctx.flags.push({
    file: ctx.file.path, line: lineOf(ctx.file.text, ctx.base + opening.start!), kind: 'inline-svg-icon',
    message: 'An inline svg sits in a back or next control and may point the wrong way in Arabic.',
    suggestion: 'Add data-dk-mirror="" to the svg, or rtl:-scale-x-100 to its class.',
  })
}

function visitExpression(container: Node, parent: Node, ctx: Context): void {
  if (parent.type !== 'JSXElement' && parent.type !== 'JSXFragment') return
  if (parent.type === 'JSXElement') {
    const opening = parent.openingElement as Node
    if (tagName(opening) === 'bdi' || attributeNamed(opening, 'dir')) return
  }
  const expression = container.expression as Node
  if (!isNumberExpression(expression)) return
  ctx.edits.push({ start: ctx.base + container.start!, end: ctx.base + container.start!, text: '<bdi>' })
  ctx.edits.push({ start: ctx.base + container.end!, end: ctx.base + container.end!, text: '</bdi>' })
}

function walk(node: unknown, ctx: Context, ancestors: Node[]): void {
  if (Array.isArray(node)) return node.forEach((child) => walk(child, ctx, ancestors))
  if (!node || typeof node !== 'object') return
  const n = node as Node
  if (n.type === 'JSXOpeningElement') visitOpening(n, ctx, ancestors)
  if (n.type === 'JSXExpressionContainer' && ancestors.length) visitExpression(n, ancestors[ancestors.length - 1]!, ctx)
  const next = typeof n.type === 'string' ? [...ancestors, n] : ancestors
  for (const [key, child] of Object.entries(n)) if (!SKIP.has(key)) walk(child, ctx, next)
}

/**
 * Mirrors directional icons from known icon packages, isolates prices and other numbers in `<bdi>`,
 * gives phone, email and url inputs `dir="ltr"`, and flags inline svgs in back and next controls.
 */
export function markupEdits(file: SourceFile): FileResult {
  const edits: Edit[] = []
  const flags: Flag[] = []
  for (const block of file.js) {
    const program = block.ast.program as unknown as Node
    walk(program, { file, base: block.offset, icons: iconImports(program), edits, flags }, [])
  }
  return { edits, flags }
}
