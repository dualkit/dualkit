import type { SourceFile } from '@dualkit/lint'
import type { LedgerEntry } from '../ledger'
import type { Edit, FileResult, Flag, FlagKind } from '../types'
import { lineOf } from './lines'
import { FUNCTIONS, componentOf, isOwnHook, tInScope, type Node } from './scope'

export type { Node } from './scope'

const SKIP = new Set(['loc', 'leadingComments', 'trailingComments', 'innerComments', 'extra'])
const TEXT_ATTRIBUTES = new Set(['alt', 'title', 'placeholder', 'aria-label', 'label'])
const LETTER = /\p{L}/u
const PROSE = /^\p{Lu}\p{Ll}/u
const NOT_PROSE = /[/\\_=<>{}@#|]/

export type Lib = 'next-intl' | 'react-i18next'

type Context = {
  file: SourceFile; base: number; lib: Lib; stem: string; used: Set<string>; byText: Map<string, string>
  entries: LedgerEntry[]; edits: Edit[]; flags: Flag[]; components: Set<Node>; sawJsx: boolean
}

type Piece =
  | { kind: 'text'; value: string; start: number; end: number }
  | { kind: 'value'; name: string; source: string; start: number; end: number }
  | { kind: 'element'; texty: boolean; start: number; end: number }
  | { kind: 'space' | 'comment' | 'other'; start: number; end: number }

const ascii = (text: string): string => text.normalize('NFKD').replace(/[̀-ͯ]/g, '')

const ROUTE_STEMS = new Set(['page', 'layout', 'index', 'route', 'default'])

const kebab = (text: string): string =>
  ascii(text).replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** The route directories of a route file: after the app dir, else the parent; groups and convert's `[locale]` skipped, `[id]` read as `id`. */
function routeDirs(dirs: string[]): string[] {
  const app = dirs.lastIndexOf('app')
  const route = app === -1 ? dirs.slice(-1) : dirs.slice(app + 1)
  return route.filter((d) => !/^\(.*\)$/.test(d) && d !== '[locale]').map((d) => d.replace(/^\[+(\.\.\.)?|\]+$/g, ''))
}

/** The key prefix for a file: its stem in kebab case, or for page, layout and other route files its route, `home` at the root. */
function stemOf(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean)
  const stem = parts.pop()!.split('.')[0]!
  if (!ROUTE_STEMS.has(stem)) return kebab(stem) || 'file'
  return kebab(routeDirs(parts).join('-')) || 'home'
}

/** The first four ASCII words of a message, placeholders left out, in kebab case. */
const keyWords = (en: string): string =>
  ascii(en.replace(/\{[^}]*\}/g, ' ')).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).slice(0, 4).join('-') || 'text'

function flag(ctx: Context, offset: number, kind: FlagKind, message: string, suggestion: string): void {
  ctx.flags.push({ file: ctx.file.path, line: lineOf(ctx.file.text, offset), kind, message, suggestion })
}

function keyFor(ctx: Context, en: string): string {
  const known = ctx.byText.get(en)
  if (known) return known
  const base = `${ctx.stem}.${keyWords(en)}`
  let key = base
  for (let n = 2; ctx.used.has(key); n++) key = `${base}-${n}`
  ctx.used.add(key)
  ctx.byText.set(en, key)
  return key
}

/** Replaces a span with a translation call, or flags it when no component encloses it. */
function place(ctx: Context, ancestors: Node[], start: number, end: number, en: string, values: string): void {
  const component = componentOf(ancestors)
  if (!component) {
    flag(ctx, start, 'outside-component', `"${en}" sits outside a component, so convert cannot give it a translation hook.`,
      'Move the text into a component, or translate it where it is used.')
    return
  }
  if (ctx.lib === 'react-i18next' && component.async) {
    flag(ctx, start, 'unsupported', `"${en}" sits in an async component, where the react-i18next hook cannot run, so it was left as it is.`,
      'Move the text into a component that is not async, or translate it there with i18n.t from the i18n setup convert added.')
    return
  }
  if (tInScope(ancestors)) {
    flag(ctx, start, 'unsupported', `"${en}" was left as it is: a variable named t is already in scope, so a translation hook would clash with it.`,
      'Rename that variable, then run convert again, or translate this text by hand.')
    return
  }
  const isNew = !ctx.byText.has(en)
  const key = keyFor(ctx, en)
  if (isNew) ctx.entries.push({ key, en, ar: '', status: 'pending', file: ctx.file.path, line: lineOf(ctx.file.text, start) })
  ctx.edits.push({ start, end, text: `{t('${key}'${values ? `, { ${values} }` : ''})}` })
  ctx.components.add(component)
}

/** Methods that turn a value into text, so a call to one reads as that value in a sentence. */
const TEXT_METHODS = /^(toLocale(Date|Time)?String|toFixed|toPrecision|toString|toUpperCase|toLowerCase|trim(Start|End)?|padStart|padEnd)$/

/** The value a text method is called on, as in `renewsOn` for `renewsOn.toLocaleDateString()`, or null. */
function textMethodTarget(expression: Node): Node | null {
  if (expression.type !== 'CallExpression' && expression.type !== 'OptionalCallExpression') return null
  const callee = expression.callee as Node
  if ((callee.type !== 'MemberExpression' && callee.type !== 'OptionalMemberExpression') || callee.computed) return null
  const method = callee.property as Node
  return method.type === 'Identifier' && TEXT_METHODS.test(method.name as string) ? (callee.object as Node) : null
}

/** The placeholder name of an identifier, a non-computed member chain or a text method called on one, or null. */
function placeholderName(expression: Node): string | null {
  const target = textMethodTarget(expression)
  if (target) return placeholderName(target)
  if (expression.type === 'Identifier') return expression.name as string
  if ((expression.type === 'MemberExpression' || expression.type === 'OptionalMemberExpression') && !expression.computed) {
    const property = expression.property as Node
    return property.type === 'Identifier' ? (property.name as string) : null
  }
  return null
}

/** Whether an element holds text or an expression anywhere inside it. Attributes do not count. */
function hasText(element: Node): boolean {
  return ((element.children as Node[]) ?? []).some((c) =>
    c.type === 'JSXText' ? /\S/.test(String(c.value))
      : c.type === 'JSXExpressionContainer' ? (c.expression as Node).type !== 'JSXEmptyExpression'
        : c.type === 'JSXSpreadChild' || hasText(c))
}

function pieceOf(child: Node, ctx: Context): Piece {
  const start = ctx.base + child.start!
  const end = ctx.base + child.end!
  if (child.type === 'JSXText') {
    const raw = ctx.file.text.slice(start, end)
    if (!/\S/.test(raw)) return { kind: 'space', start, end }
    const lead = raw.length - raw.trimStart().length
    const trail = raw.length - raw.trimEnd().length
    return { kind: 'text', value: String(child.value), start: start + lead, end: end - trail }
  }
  if (child.type === 'JSXSpreadChild') return { kind: 'other', start, end }
  if (child.type !== 'JSXExpressionContainer') return { kind: 'element', texty: hasText(child), start, end }
  const expression = child.expression as Node
  if (expression.type === 'JSXEmptyExpression') return { kind: 'comment', start, end }
  if (expression.type === 'StringLiteral') {
    const value = String(expression.value)
    return /\S/.test(value) ? { kind: 'text', value, start, end } : { kind: 'space', start, end }
  }
  const name = placeholderName(expression)
  if (!name) return { kind: 'other', start, end }
  const source = ctx.file.text.slice(ctx.base + expression.start!, ctx.base + expression.end!)
  return { kind: 'value', name, source, start, end }
}

const mixed = (ctx: Context, offset: number): void =>
  flag(ctx, offset, 'mixed-text', 'This text shares its element with other elements or expressions, so it was left as it is.',
    'Translate the whole sentence with rich text or a plural message, by hand.')

/** The `{ name }` values for a run's placeholders, or null when two placeholders collide. */
function valuesOf(pieces: Piece[]): string | null {
  const seen = new Map<string, string>()
  for (const p of pieces) {
    if (p.kind !== 'value') continue
    if (seen.has(p.name) && seen.get(p.name) !== p.source) return null
    seen.set(p.name, p.source)
  }
  return [...seen].map(([name, source]) => (name === source ? name : `${name}: ${source}`)).join(', ')
}

/** Splits children into runs of text and expressions, with the elements on either side of each run. */
function unitsOf(pieces: Piece[]): { run: Piece[]; touchesText: boolean }[] {
  const units: { run: Piece[]; touchesText: boolean }[] = []
  let run: Piece[] = []
  let before: Piece | undefined
  for (const piece of [...pieces, undefined]) {
    if (piece && piece.kind !== 'element') { run.push(piece); continue }
    const texty = (p: Piece | undefined): boolean => p?.kind === 'element' && p.texty
    if (run.length) units.push({ run, touchesText: texty(before) || texty(piece) })
    run = []
    before = piece
  }
  return units
}

type Message = { start: number; end: number; en: string; values: string }

/** One run of text as a message, or null when the run is mixed text. */
function messageOf(pieces: Piece[]): Message | null {
  if (pieces.some((p) => p.kind === 'other')) return null
  const edge = (p: Piece): boolean => p.kind !== 'space' && p.kind !== 'comment'
  const first = pieces.findIndex(edge)
  const last = pieces.length - 1 - [...pieces].reverse().findIndex(edge)
  const run = pieces.slice(first, last + 1)
  const values = valuesOf(run)
  if (values === null || run.some((p) => p.kind === 'comment')) return null
  const en = run.map((p) => (p.kind === 'text' ? p.value : p.kind === 'value' ? `{${p.name}}` : ' '))
    .join('').replace(/\s+/g, ' ').trim()
  return { start: run[0]!.start, end: run[run.length - 1]!.end, en, values }
}

/**
 * Extracts each run of text between elements that hold no text (icons, line breaks) as its own message.
 * When any run sits next to an element with text, or holds a non-simple expression, the element is flagged
 * once as mixed text and nothing in it is changed. Returns false in that case.
 */
function visitChildren(element: Node, ctx: Context, ancestors: Node[]): boolean {
  const pieces = ((element.children as Node[]) ?? []).map((c) => pieceOf(c, ctx))
  const messages: Message[] = []
  for (const { run, touchesText } of unitsOf(pieces)) {
    const lettered = run.find((p) => p.kind === 'text' && LETTER.test(p.value))
    if (!lettered) continue
    const message = touchesText ? null : messageOf(run)
    if (!message) {
      mixed(ctx, lettered.start)
      return false
    }
    messages.push(message)
  }
  for (const m of messages) place(ctx, ancestors, m.start, m.end, m.en, m.values)
  return true
}

function visitAttribute(attribute: Node, ctx: Context, ancestors: Node[]): void {
  const name = attribute.name as Node
  if (name.type !== 'JSXIdentifier' || !TEXT_ATTRIBUTES.has(name.name as string)) return
  const value = attribute.value as Node | null
  const literal = value?.type === 'JSXExpressionContainer' ? (value.expression as Node) : value
  if (literal?.type !== 'StringLiteral' || !LETTER.test(String(literal.value))) return
  const en = String(literal.value).replace(/\s+/g, ' ').trim()
  place(ctx, ancestors, ctx.base + value!.start!, ctx.base + value!.end!, en, '')
}

function walk(node: unknown, ctx: Context, ancestors: Node[]): void {
  if (Array.isArray(node)) return node.forEach((child) => walk(child, ctx, ancestors))
  if (!node || typeof node !== 'object') return
  const n = node as Node
  if (n.type === 'JSXElement' || n.type === 'JSXFragment') {
    ctx.sawJsx = true
    if (!visitChildren(n, ctx, ancestors)) return
  }
  if (n.type === 'JSXAttribute') visitAttribute(n, ctx, ancestors)
  const next = typeof n.type === 'string' ? [...ancestors, n] : ancestors
  for (const [key, child] of Object.entries(n)) if (!SKIP.has(key)) walk(child, ctx, next)
}

/** The first prose-like string literal in a module-level value, outside functions and JSX. */
function proseLiteral(node: unknown): Node | null {
  if (Array.isArray(node)) return node.map(proseLiteral).find(Boolean) ?? null
  if (!node || typeof node !== 'object') return null
  const n = node as Node
  if (FUNCTIONS.has(n.type!) || n.type?.startsWith('JSX')) return null
  if (n.type === 'StringLiteral') {
    const value = String(n.value)
    return PROSE.test(value) && !NOT_PROSE.test(value) ? n : null
  }
  for (const [key, child] of Object.entries(n)) {
    if (SKIP.has(key)) continue
    const found = proseLiteral(child)
    if (found) return found
  }
  return null
}

function flagModuleStrings(program: Node, ctx: Context): void {
  for (const statement of (program.body as Node[]) ?? []) {
    const declaration = statement.type?.startsWith('Export') ? (statement.declaration as Node | null) : statement
    if (declaration?.type !== 'VariableDeclaration') continue
    for (const declarator of (declaration.declarations as Node[]) ?? []) {
      const literal = proseLiteral(declarator.init)
      if (!literal) continue
      flag(ctx, ctx.base + literal.start!, 'outside-component', `"${String(literal.value)}" is set at module level, outside any component.`,
        'Translate it where a component shows it, or move it into the component.')
    }
  }
}

type Import = { name: string; source: string }
export type Style = { semi: string; quote: string }

/** Whether the file ends statements with semicolons, and which quote its imports use. */
export function styleOf(program: Node, text: string, base: number): Style {
  const first = ((program.body as Node[]) ?? [])[0]
  const semi = first && text[base + first.end! - 1] === ';' ? ';' : ''
  const source = ((program.body as Node[]) ?? []).find((s) => s.type === 'ImportDeclaration')?.source as Node | undefined
  const quote = String((source?.extra as Node | undefined)?.raw ?? "'").startsWith('"') ? '"' : "'"
  return { semi, quote }
}

const hookFor = (lib: Lib, async: boolean): { statement: string; import: Import } =>
  lib === 'react-i18next'
    ? { statement: 'const { t } = useTranslation()', import: { name: 'useTranslation', source: 'react-i18next' } }
    : async
      ? { statement: 'const t = await getTranslations()', import: { name: 'getTranslations', source: 'next-intl/server' } }
      : { statement: 'const t = useTranslations()', import: { name: 'useTranslations', source: 'next-intl' } }

/** The leading whitespace of the line an offset sits on. */
const indentAt = (text: string, offset: number): string =>
  /^[ \t]*/.exec(text.slice(text.lastIndexOf('\n', offset - 1) + 1, offset))![0]

/** The edits that give a component its hook as its first statement, and the import the hook needs. */
function hookEdits(fn: Node, lib: Lib, text: string, base: number, style: Style): { edits: Edit[]; imports: Import[] } {
  const hook = hookFor(lib, Boolean(fn.async))
  const body = fn.body as Node
  const statement = hook.statement + style.semi
  if (body.type === 'BlockStatement') {
    const statements = (body.body as Node[]) ?? []
    if (statements.some(isOwnHook)) return { edits: [], imports: [hook.import] }
    const at = base + (statements[0]?.start ?? body.start! + 1)
    const prefix = text.slice(text.lastIndexOf('\n', at - 1) + 1, at)
    const insert = /^\s*$/.test(prefix) ? `${statement}\n${prefix}` : `${hook.statement}; `
    return { edits: [{ start: at, end: at, text: insert }], imports: [hook.import] }
  }
  const extra = body.extra as Node | undefined
  const open = base + (extra?.parenthesized ? (extra.parenStart as number) : body.start!)
  const indent = indentAt(text, base + fn.start!)
  return {
    edits: [
      { start: open, end: open, text: `{\n${indent}  ${statement}\n${indent}  return ` },
      { start: base + fn.end!, end: base + fn.end!, text: `\n${indent}}` },
    ],
    imports: [hook.import],
  }
}

const hasImport = (program: Node, wanted: Import): boolean =>
  ((program.body as Node[]) ?? []).some((s) => s.type === 'ImportDeclaration' && (s.source as Node).value === wanted.source
    && ((s.specifiers as Node[]) ?? []).some((spec) => {
      const imported = spec.imported as Node | undefined
      return spec.type === 'ImportSpecifier' && (imported?.name ?? imported?.value) === wanted.name
    }))

/** One import line per missing hook import, placed after the last import, else after the directives, else at the top. */
function importEdits(program: Node, wanted: Import[], base: number, style: Style): Edit[] {
  const unique = [...new Map(wanted.map((w) => [`${w.source}#${w.name}`, w])).values()].filter((w) => !hasImport(program, w))
  if (!unique.length) return []
  const lines = unique.map((w) => `import { ${w.name} } from ${style.quote}${w.source}${style.quote}${style.semi}`)
  const body = (program.body as Node[]) ?? []
  const anchor = [...body].reverse().find((s) => s.type === 'ImportDeclaration') ?? ((program.directives as Node[]) ?? []).at(-1)
  if (!anchor) return [{ start: base, end: base, text: lines.map((l) => `${l}\n`).join('') }]
  const at = base + anchor.end!
  return [{ start: at, end: at, text: lines.map((l) => `\n${l}`).join('') }]
}

const isServerFile = (program: Node): boolean =>
  ((program.directives as Node[]) ?? []).some((d) => (d.value as Node).value === 'use server')

/**
 * Replaces user-facing JSX text and text attributes with `t()` calls, adds the translation hook to each
 * component and the import once, and returns the new ledger entries. Mixed text and strings outside
 * components are flagged and left as they are. `taken` is read, never changed.
 */
export function extractStrings(file: SourceFile, lib: Lib, taken: Set<string>): FileResult & { entries: LedgerEntry[] } {
  const entries: LedgerEntry[] = []
  const edits: Edit[] = []
  const flags: Flag[] = []
  const used = new Set(taken)
  for (const block of file.js) {
    const program = block.ast.program as unknown as Node
    if (isServerFile(program)) continue
    const ctx: Context = { file, base: block.offset, lib, stem: stemOf(file.path), used, byText: new Map(), entries, edits, flags, components: new Set(), sawJsx: false }
    walk(program, ctx, [])
    if (ctx.sawJsx) flagModuleStrings(program, ctx)
    const style = styleOf(program, file.text, ctx.base)
    const hooks = [...ctx.components].map((fn) => hookEdits(fn, lib, file.text, ctx.base, style))
    edits.push(...hooks.flatMap((h) => h.edits))
    edits.push(...importEdits(program, hooks.flatMap((h) => h.imports), ctx.base, style))
  }
  return { edits, flags, entries }
}
