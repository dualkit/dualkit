import type { SourceFile } from '@dualkit/lint'
import type { LedgerEntry } from '../ledger'
import type { Edit, FileResult, Flag, FlagKind } from '../types'
import { lineOf } from './lines'
import { FUNCTIONS, componentOf, isOwnHook, tInScope, type Node } from './scope'

export type { Node } from './scope'

const SKIP = new Set(['loc', 'leadingComments', 'trailingComments', 'innerComments', 'extra'])
const TEXT_ATTRIBUTES = new Set([
  'alt', 'title', 'placeholder', 'aria-label', 'label', 'aria-description', 'aria-placeholder', 'aria-roledescription',
  'description', 'subtitle', 'heading', 'caption', 'hint', 'tooltip', 'helperText', 'pageTitle',
])
/** Elements that sit inside a sentence, so their text belongs to the sentence around them. */
const INLINE = new Set(['a', 'abbr', 'b', 'bdi', 'cite', 'code', 'del', 'em', 'i', 'ins', 'kbd', 'Link', 'mark', 'q', 's', 'small', 'span', 'strong', 'sub', 'sup', 'u'])
const LETTER = /\p{L}/u
const PROSE = /^\p{Lu}\p{Ll}/u
const NOT_PROSE = /[/\\_=<>{}@#|]/

export type Lib = 'next-intl' | 'react-i18next'

type Context = {
  file: SourceFile; base: number; lib: Lib; stem: string; used: Set<string>; byText: Map<string, string>
  entries: LedgerEntry[]; edits: Edit[]; flags: Flag[]; components: Set<Node>; sawJsx: boolean
  consumed: Set<Node>; usedTrans: boolean
}

type Piece =
  | { kind: 'text'; value: string; start: number; end: number }
  | { kind: 'value'; name: string; source: string; start: number; end: number }
  | { kind: 'element'; node: Node; start: number; end: number }
  | { kind: 'space'; value: string; start: number; end: number }
  | { kind: 'comment'; start: number; end: number }
  | { kind: 'other'; node: Node; start: number; end: number }

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
export function stemOf(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean)
  const stem = parts.pop()!.split('.')[0]!
  if (!ROUTE_STEMS.has(stem)) return kebab(stem) || 'file'
  return kebab(routeDirs(parts).join('-')) || 'home'
}

/** The first four ASCII words of a message, placeholders left out, in kebab case. */
export const keyWords = (en: string): string =>
  ascii(en.replace(/\{[^}]*\}|<[^>]*>/g, ' ')).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).slice(0, 4).join('-') || 'text'

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

/** What a message becomes in the code: a key and its source text, and how to print the call. */
type Replacement = { start: number; end: number; en: string; code: (key: string) => string; hookless?: boolean }

/** Replaces a span with a translation call, or flags it when no component encloses it. */
function place(ctx: Context, ancestors: Node[], { start, end, en, code, hookless }: Replacement): void {
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
  ctx.edits.push({ start, end, text: code(key) })
  if (!hookless) ctx.components.add(component)
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

/** Whether a value holds JSX anywhere inside it. */
function holdsJsx(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(holdsJsx)
  if (!node || typeof node !== 'object') return false
  const n = node as Node
  if (n.type === 'JSXElement' || n.type === 'JSXFragment') return true
  return Object.entries(n).some(([key, child]) => !SKIP.has(key) && holdsJsx(child))
}

/** The placeholder name for a call that returns a value to print, such as `format` for `format(date)`, or null. */
function callName(expression: Node): string | null {
  if (expression.type !== 'CallExpression' && expression.type !== 'OptionalCallExpression') return null
  if (holdsJsx(expression)) return null
  const callee = expression.callee as Node
  if (callee.type === 'Identifier') return callee.name === 't' ? null : (callee.name as string)
  if ((callee.type === 'MemberExpression' || callee.type === 'OptionalMemberExpression') && !callee.computed) return placeholderName(callee)
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
    if (!/\S/.test(raw)) return { kind: 'space', value: raw.includes('\n') ? '' : ' ', start, end }
    const lead = raw.length - raw.trimStart().length
    const trail = raw.length - raw.trimEnd().length
    return { kind: 'text', value: jsxText(String(child.value)), start: start + lead, end: end - trail }
  }
  if (child.type === 'JSXSpreadChild') return { kind: 'other', node: child, start, end }
  if (child.type !== 'JSXExpressionContainer') return { kind: 'element', node: child, start, end }
  const expression = child.expression as Node
  if (expression.type === 'JSXEmptyExpression') return { kind: 'comment', start, end }
  if (expression.type === 'StringLiteral') {
    const value = String(expression.value)
    return /\S/.test(value) ? { kind: 'text', value, start, end } : { kind: 'space', value, start, end }
  }
  const name = placeholderName(expression) ?? callName(expression)
  if (!name || NODE_NAMES.test(name)) return { kind: 'other', node: expression, start, end }
  const source = ctx.file.text.slice(ctx.base + expression.start!, ctx.base + expression.end!)
  return { kind: 'value', name, source: mayBeEmpty(expression) ? `${source} ?? ''` : source, start, end }
}

/** Code that sets the direction of the page on its own. */
const OWN_DIRECTION = /setAttribute\(\s*['"]dir['"]|documentElement\.dir\s*=[^=]/

/** Names that usually hold a React node, which a message value cannot be. */
const NODE_NAMES = /^(children|icon|avatar|logo|image|element|node)$/i

/** Whether a value can be null or undefined at run time, which next-intl would reject. */
const mayBeEmpty = (expression: Node): boolean =>
  /^Optional/.test(expression.type!) || (expression.type === 'CallExpression' && !textMethodTarget(expression))

/** JSX text as React prints it: whitespace that holds a line break is dropped at either end. */
const jsxText = (value: string): string => value.replace(/^\s*\n\s*/, '').replace(/\s*\n\s*$/, '')

const mixed = (ctx: Context, offset: number): void =>
  flag(ctx, offset, 'mixed-text', 'This text shares its element with an expression convert cannot read as one sentence, so it was left as it is.',
    'Translate the whole sentence with a plural message, by hand.')

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

const tagName = (element: Node): string | null => {
  const name = ((element.openingElement as Node | undefined)?.name as Node | undefined)
  return name?.type === 'JSXIdentifier' ? (name.name as string) : null
}

const childPieces = (element: Node, ctx: Context): Piece[] => ((element.children as Node[]) ?? []).map((c) => pieceOf(c, ctx))

/** Whether an element can sit in a sentence: an inline tag with text inside it, holding only text and simple values. */
function isInline(element: Node, ctx: Context): boolean {
  if (!INLINE.has(tagName(element) ?? '') || !hasText(element)) return false
  return childPieces(element, ctx).every((p) => p.kind === 'text' || p.kind === 'value' || p.kind === 'space')
}

/** Splits children at everything that cannot sit in a sentence: icons, block elements and expressions with no simple value. */
function runsOf(pieces: Piece[], ctx: Context): Piece[][] {
  const runs: Piece[][] = []
  let run: Piece[] = []
  for (const piece of pieces) {
    if (piece.kind === 'other' || (piece.kind === 'element' && !isInline(piece.node, ctx))) {
      if (run.length) runs.push(run)
      run = []
    } else run = [...run, piece]
  }
  return run.length ? [...runs, run] : runs
}

/** A branch that glues letters onto a word, as in `item{n === 1 ? '' : 's'}`, which only a plural message can say. */
const gluedTo = (piece: Piece, next: Piece | undefined, previous: Piece | undefined): boolean =>
  piece.kind === 'other' && piece.node.type === 'ConditionalExpression' && branchStrings(piece.node).some((n) => String(n.value).length < 3)
    && ((previous?.kind === 'text' && /\S$/.test(previous.value)) || (next?.kind === 'text' && /^\S/.test(next.value)))

/**
 * One tag for a message per element, as `a`, then `a2`, and how the element reads in the message and the code.
 * `Link` becomes `navlink` because react-i18next reads `<link>` as a void HTML tag and drops its text.
 */
type Tag = { tag: string; open: string; close: string; inner: Piece[] }

function tagsOf(run: Piece[], ctx: Context): Map<Piece, Tag> {
  const counts = new Map<string, number>()
  const tags = new Map<Piece, Tag>()
  for (const piece of run) {
    if (piece.kind !== 'element') continue
    const name = tagName(piece.node)!
    const base = name === 'Link' ? 'navlink' : name.toLowerCase()
    const count = (counts.get(base) ?? 0) + 1
    counts.set(base, count)
    const open = piece.node.openingElement as Node
    const close = piece.node.closingElement as Node
    tags.set(piece, {
      tag: count === 1 ? base : `${base}${count}`,
      open: ctx.file.text.slice(ctx.base + open.start!, ctx.base + open.end!),
      close: ctx.file.text.slice(ctx.base + close.start!, ctx.base + close.end!),
      inner: childPieces(piece.node, ctx),
    })
  }
  return tags
}

const plainText = (pieces: Piece[]): string =>
  pieces.map((p) => (p.kind === 'text' || p.kind === 'space' ? p.value : p.kind === 'value' ? `{${p.name}}` : '')).join('')

const nextIntlCode = (key: string, values: string, tags: Tag[]): string => {
  if (!tags.length) return `{t('${key}'${values ? `, { ${values} }` : ''})}`
  const parts = [...(values ? [values] : []), ...tags.map((t) => `${t.tag}: (chunks) => ${t.open}{chunks}${t.close}`)]
  return `{t.rich('${key}', { ${parts.join(', ')} })}`
}

const reactI18nextCode = (key: string, values: string, tags: Tag[]): string => {
  if (!tags.length) return nextIntlCode(key, values, tags)
  const components = tags.map((t) => `${t.tag}: ${t.open.replace(/>$/, ' />')}`).join(', ')
  return `<Trans i18nKey="${key}"${values ? ` values={{ ${values} }}` : ''} components={{ ${components} }} />`
}

/** One run as a message, or null when two of its placeholders collide or a comment sits inside it. */
function messageOf(pieces: Piece[], ctx: Context): (Replacement & { tags: Tag[] }) | null {
  const edge = (p: Piece): boolean => p.kind !== 'space' && p.kind !== 'comment'
  const first = pieces.findIndex(edge)
  const last = pieces.length - 1 - [...pieces].reverse().findIndex(edge)
  const run = pieces.slice(first, last + 1)
  if (run.some((p) => p.kind === 'comment')) return null
  const tags = tagsOf(run, ctx)
  const values = valuesOf([...run, ...[...tags.values()].flatMap((t) => t.inner)])
  if (values === null) return null
  const en = run.map((p) => {
    const tag = tags.get(p)
    return tag ? `<${tag.tag}>${plainText(tag.inner)}</${tag.tag}>` : plainText([p])
  }).join('').replace(/\s+/g, ' ').trim()
  const list = [...tags.values()]
  const code = (key: string): string => (ctx.lib === 'react-i18next' ? reactI18nextCode : nextIntlCode)(key, values, list)
  return { start: run[0]!.start, end: run[run.length - 1]!.end, en, code, tags: list, hookless: ctx.lib === 'react-i18next' && list.length > 0 }
}

/**
 * Extracts each sentence between things that cannot sit in one, so a card with a stray word next to a
 * block still has its other text extracted. Inline elements join their sentence as rich text. A run
 * convert cannot read as one sentence is flagged and left, and the rest of the element carries on.
 */
function visitChildren(element: Node, ctx: Context, ancestors: Node[]): void {
  const pieces = childPieces(element, ctx)
  pieces.forEach((piece, i) => {
    if (!gluedTo(piece, pieces[i + 1], pieces[i - 1])) return
    ctx.consumed.add((piece as { node: Node }).node)
  })
  const glued = pieces.filter((p, i) => p.kind === 'other' && gluedTo(p, pieces[i + 1], pieces[i - 1]))
  for (const run of runsOf(pieces, ctx)) {
    const lettered = run.find((p) => p.kind === 'text' && LETTER.test(p.value))
    if (!lettered) continue
    const touchesGlue = glued.some((g) => run.some((p) => p.end === g.start || p.start === g.end
      || ctx.file.text.slice(p.end, g.start).trim() === '' || ctx.file.text.slice(g.end, p.start).trim() === ''))
    const message = touchesGlue ? null : messageOf(run, ctx)
    if (!message) {
      mixed(ctx, lettered.start)
      continue
    }
    if (message.tags.length) {
      run.forEach((p) => { if (p.kind === 'element') ctx.consumed.add(p.node) })
      if (ctx.lib === 'react-i18next') ctx.usedTrans = true
    }
    place(ctx, ancestors, message)
  }
}

const bracedCall = (values: string) => (key: string): string => `{t('${key}'${values ? `, { ${values} }` : ''})}`

function visitAttribute(attribute: Node, ctx: Context, ancestors: Node[]): void {
  const name = attribute.name as Node
  if (name.type !== 'JSXIdentifier' || !TEXT_ATTRIBUTES.has(name.name as string)) return
  const value = attribute.value as Node | null
  const literal = value?.type === 'JSXExpressionContainer' ? (value.expression as Node) : value
  if (literal?.type !== 'StringLiteral' || !LETTER.test(String(literal.value))) return
  if (name.name === 'placeholder' && /^(blur|empty)$/.test(String(literal.value))) return
  const en = String(literal.value).replace(/\s+/g, ' ').trim()
  place(ctx, ancestors, { start: ctx.base + value!.start!, end: ctx.base + value!.end!, en, code: bracedCall('') })
}

/** The string literals an expression can resolve to through ternaries and fallbacks. */
function branchStrings(node: Node): Node[] {
  if (node.type === 'StringLiteral') return [node]
  if (node.type === 'ConditionalExpression') return [...branchStrings(node.consequent as Node), ...branchStrings(node.alternate as Node)]
  if (node.type === 'LogicalExpression') return branchStrings(node.right as Node)
  return []
}

/** Replaces strings in the branches of a JSX expression, as in `{saving ? 'Saving' : 'Save'}`, whose test stays as it is. */
function visitBranches(container: Node, ctx: Context, ancestors: Node[]): void {
  const parent = ancestors.at(-1)
  const expression = container.expression as Node
  const shown = parent?.type === 'JSXElement' || parent?.type === 'JSXFragment'
    || (parent?.type === 'JSXAttribute' && TEXT_ATTRIBUTES.has((parent.name as Node).name as string))
  if (!shown || expression.type === 'StringLiteral' || ctx.consumed.has(expression)) return
  for (const literal of branchStrings(expression)) {
    const en = String(literal.value).replace(/\s+/g, ' ').trim()
    if (!LETTER.test(en) || NOT_PROSE.test(en)) continue
    place(ctx, ancestors, { start: ctx.base + literal.start!, end: ctx.base + literal.end!, en, code: (key) => `t('${key}')` })
  }
}

function walk(node: unknown, ctx: Context, ancestors: Node[]): void {
  if (Array.isArray(node)) return node.forEach((child) => walk(child, ctx, ancestors))
  if (!node || typeof node !== 'object') return
  const n = node as Node
  if (ctx.consumed.has(n)) return
  if (n.type === 'JSXElement' || n.type === 'JSXFragment') {
    ctx.sawJsx = true
    visitChildren(n, ctx, ancestors)
  }
  if (n.type === 'JSXAttribute') visitAttribute(n, ctx, ancestors)
  if (n.type === 'JSXExpressionContainer') visitBranches(n, ctx, ancestors)
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
export function hookEdits(fn: Node, lib: Lib, text: string, base: number, style: Style): { edits: Edit[]; imports: Import[] } {
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
export function importEdits(program: Node, wanted: Import[], base: number, style: Style): Edit[] {
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
    if (OWN_DIRECTION.test(file.text.slice(block.offset))) {
      flag({ file, flags } as Context, block.offset, 'unsupported', 'This file sets the page direction itself, which can clash with the Arabic layout.',
        'Check the Arabic pages, and drive this direction from the locale so components read it too.')
    }
    const ctx: Context = { file, base: block.offset, lib, stem: stemOf(file.path), used, byText: new Map(), entries, edits, flags, components: new Set(), sawJsx: false, consumed: new Set(), usedTrans: false }
    walk(program, ctx, [])
    if (ctx.sawJsx) flagModuleStrings(program, ctx)
    const style = styleOf(program, file.text, ctx.base)
    const hooks = [...ctx.components].map((fn) => hookEdits(fn, lib, file.text, ctx.base, style))
    edits.push(...hooks.flatMap((h) => h.edits))
    const trans = ctx.usedTrans ? [{ name: 'Trans', source: 'react-i18next' }] : []
    edits.push(...importEdits(program, [...hooks.flatMap((h) => h.imports), ...trans], ctx.base, style))
  }
  return { edits, flags, entries }
}
