import type { SourceFile } from '@dualkit/lint'
import type { Edit, FileResult, Flag } from '../types'
import { addImports, specifierTo, type NamedImport } from './imports'
import { lineOf } from './lines'
import { componentOf, isOwnHook, scopeNames, type Node } from './scope'
import { styleOf, type Lib, type Style } from './strings'

const SKIP = new Set(['loc', 'leadingComments', 'trailingComments', 'innerComments', 'extra'])
const INTL = new Set(['NumberFormat', 'DateTimeFormat'])
const TO_LOCALE = new Set(['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString'])
const ENGLISH = /^en(-[A-Za-z0-9]+)*$/i
const DATE_NAME = /Date|Calendar|Picker/

/** Date picker and calendar packages: null flags any import, a pattern flags matching names only. */
const PICKERS: ReadonlyArray<readonly [RegExp, RegExp | null]> = [
  [/^react-day-picker$/, null],
  [/^react-datepicker$/, null],
  [/^react-calendar$/, null],
  [/^react-date-range$/, null],
  [/^react-big-calendar$/, null],
  [/^react-flatpickr$/, null],
  [/^@fullcalendar\/react$/, null],
  [/^primereact\/calendar$/, null],
  [/^@mui\/x-date-pickers(-pro)?(\/.*)?$/, DATE_NAME],
  [/^@mantine\/dates$/, DATE_NAME],
  [/^@ark-ui\/react(\/.*)?$/, /DatePicker/],
  [/^(@heroui|@nextui-org)\/(react|date-picker|calendar)$/, DATE_NAME],
  [/^antd$/, /^(DatePicker|Calendar)$/],
]

type Hooked = { fn: Node; hook: Node; own: Node | null }

type Context = {
  file: SourceFile; base: number; lib: Lib; helper: string
  edits: Edit[]; flags: Flag[]; hooked: Map<Node, Hooked>
}

const idName = (node: Node | undefined): unknown => (node?.type === 'Identifier' ? node.name : undefined)
const statementsOf = (fn: Node): Node[] => ((fn.body as Node).type === 'BlockStatement' ? (((fn.body as Node).body as Node[]) ?? []) : [])
const callOf = (d: Node | undefined): Node | undefined => {
  const init = d?.init as Node | null | undefined
  return init?.type === 'AwaitExpression' ? (init.argument as Node) : (init ?? undefined)
}

/** Whether a statement is the locale binding formats adds: `const locale = useLocale()`, `await getLocale()` or `const { i18n } = useTranslation()`. */
function isOwnLocale(statement: Node, lib: Lib): boolean {
  const [d, extra] = (statement.declarations as Node[] | undefined) ?? []
  const call = callOf(d)
  if (statement.type !== 'VariableDeclaration' || extra || call?.type !== 'CallExpression' || ((call.arguments as Node[]) ?? []).length) return false
  const callee = idName(call.callee as Node)
  const id = d!.id as Node
  if (lib === 'react-i18next') {
    const props = id.type === 'ObjectPattern' ? ((id.properties as Node[]) ?? []) : []
    return callee === 'useTranslation' && props.length === 1 && idName(props[0]!.value as Node) === 'i18n'
  }
  return idName(id) === 'locale' && (callee === 'useLocale' || callee === 'getLocale')
}

const bindingName = (lib: Lib): string => (lib === 'react-i18next' ? 'i18n' : 'locale')
const localeExpression = (lib: Lib): string => (lib === 'react-i18next' ? 'i18n.language' : 'locale')

/** Whether a call is an Intl formatter or a toLocale*String call. */
function isFormatCall(call: Node): boolean {
  const callee = call.callee as Node
  if (callee.type !== 'MemberExpression' && callee.type !== 'OptionalMemberExpression') return false
  if (callee.computed) return false
  const property = idName(callee.property as Node) as string | undefined
  const isIntl = idName(callee.object as Node) === 'Intl' && INTL.has(property ?? '')
  const isToLocale = call.type !== 'NewExpression' && TO_LOCALE.has(property ?? '')
  return isIntl || isToLocale
}

/** The literal locale argument of an Intl formatter or toLocale*String call, or null. */
function localeArgument(call: Node): Node | null {
  if (!isFormatCall(call)) return null
  const arg = ((call.arguments as Node[]) ?? [])[0]
  return arg?.type === 'StringLiteral' && ENGLISH.test(String(arg.value)) ? arg : null
}

/** Whether a formatter call takes the browser's locale: no locale, or undefined. */
function usesBrowserLocale(call: Node): boolean {
  if (!isFormatCall(call)) return false
  const arg = ((call.arguments as Node[]) ?? [])[0]
  return !arg || idName(arg) === 'undefined'
}

function flag(ctx: Context, offset: number, message: string, suggestion: string): void {
  ctx.flags.push({ file: ctx.file.path, line: lineOf(ctx.file.text, offset), kind: 'format', message, suggestion })
}

const helperName = (helper: string): string => helper.replace(/\.(tsx?|jsx?)$/, '')

/** Whether the binding formats would use is already declared by something other than its own statement. */
function clashes(ctx: Context, ancestors: Node[], fn: Node): boolean {
  const name = bindingName(ctx.lib)
  const from = ancestors.indexOf(fn)
  return ancestors.slice(from).some((node) => {
    if (node === fn.body && statementsOf(fn).some((s) => isOwnLocale(s, ctx.lib))) return false
    return scopeNames(node).includes(name)
  })
}

function visitLocale(arg: Node, ctx: Context, ancestors: Node[]): void {
  const start = ctx.base + arg.start!
  const value = String(arg.value)
  const fn = componentOf(ancestors)
  const hook = fn ? statementsOf(fn).find(isOwnHook) : undefined
  if (!fn || !hook) {
    flag(ctx, start, `The locale '${value}' is fixed here, so Arabic pages show English number and date formats.`,
      `Pass the active locale through dkIntlLocale from ${helperName(ctx.helper)}, or move this into a component that has the translation hook.`)
    return
  }
  if (clashes(ctx, ancestors, fn)) {
    flag(ctx, start, `The locale '${value}' was left as it is: a variable named ${bindingName(ctx.lib)} is already in scope.`,
      `Rename that variable, then run convert again, or pass dkIntlLocale(${localeExpression(ctx.lib)}) by hand.`)
    return
  }
  ctx.edits.push({ start, end: ctx.base + arg.end!, text: `dkIntlLocale(${localeExpression(ctx.lib)})` })
  if (!ctx.hooked.has(fn)) ctx.hooked.set(fn, { fn, hook, own: statementsOf(fn).find((s) => isOwnLocale(s, ctx.lib)) ?? null })
}

function visitCurrency(property: Node, ctx: Context): void {
  const key = property.key as Node
  const name = key.type === 'Identifier' && !property.computed ? key.name : key.type === 'StringLiteral' ? key.value : undefined
  const value = property.value as Node
  if (name !== 'currency' || value.type !== 'StringLiteral' || value.value !== 'USD') return
  flag(ctx, ctx.base + value.start!, 'Prices are formatted in US dollars.',
    'Offer AED for Gulf customers, with VAT shown on prices.')
}

function visitImport(declaration: Node, ctx: Context): void {
  if (declaration.importKind === 'type') return
  const source = String((declaration.source as Node).value)
  const match = PICKERS.find(([pattern]) => pattern.test(source))
  if (!match) return
  const names = ((declaration.specifiers as Node[]) ?? []).filter((s) => s.importKind !== 'type').map((s) => (s.local as Node).name as string)
  const picked = match[1] ? names.filter((n) => match[1]!.test(n)) : names
  if (!picked.length) return
  flag(ctx, ctx.base + declaration.start!, `${picked.join(', ')} from ${source} is a date picker or calendar with its own week start and calendar system.`,
    'Start weeks on Saturday for Gulf users and offer Hijri dates beside Gregorian ones where dates matter.')
}

function walk(node: unknown, ctx: Context, ancestors: Node[]): void {
  if (Array.isArray(node)) return node.forEach((child) => walk(child, ctx, ancestors))
  if (!node || typeof node !== 'object') return
  const n = node as Node
  if (n.type === 'CallExpression' || n.type === 'OptionalCallExpression' || n.type === 'NewExpression') {
    const arg = localeArgument(n)
    if (arg) visitLocale(arg, ctx, ancestors)
    else if (usesBrowserLocale(n)) {
      flag(ctx, ctx.base + n.start!, 'This formats in the browser\'s own locale, so an Arabic page can show an English date or number, such as 11/1/2026 for 1 November.',
        `Pass dkIntlLocale(${localeExpression(ctx.lib)}) from ${helperName(ctx.helper)} as the locale, so the format follows the page language.`)
    }
  }
  if (n.type === 'ObjectProperty') visitCurrency(n, ctx)
  if (n.type === 'ImportDeclaration') visitImport(n, ctx)
  const next = typeof n.type === 'string' ? [...ancestors, n] : ancestors
  for (const [key, child] of Object.entries(n)) if (!SKIP.has(key)) walk(child, ctx, next)
}

/** The leading whitespace of the line an offset sits on. */
const indentAt = (text: string, offset: number): string =>
  /^[ \t]*/.exec(text.slice(text.lastIndexOf('\n', offset - 1) + 1, offset))![0]

/** The statement that binds the locale, and the import it needs. */
function localeStatement(lib: Lib, async: boolean): { statement: string; import: NamedImport } {
  if (lib === 'react-i18next') return { statement: 'const { i18n } = useTranslation()', import: { name: 'useTranslation', source: 'react-i18next' } }
  return async
    ? { statement: 'const locale = await getLocale()', import: { name: 'getLocale', source: 'next-intl/server' } }
    : { statement: 'const locale = useLocale()', import: { name: 'useLocale', source: 'next-intl' } }
}

/** Adds the locale binding after each rewritten component's hook, and returns the imports needed. */
function bindingEdits(ctx: Context, style: Style): NamedImport[] {
  const imports: NamedImport[] = []
  for (const { fn, hook, own } of ctx.hooked.values()) {
    if (own) continue
    const binding = localeStatement(ctx.lib, Boolean(fn.async))
    const end = ctx.base + hook.end!
    const indent = indentAt(ctx.file.text, ctx.base + hook.start!)
    ctx.edits.push({ start: end, end, text: `\n${indent}${binding.statement}${style.semi}` })
    imports.push(binding.import)
  }
  return imports
}

/**
 * Rewrites literal English locales in Intl formatters and toLocale*String calls inside components that
 * have the translation hook to `dkIntlLocale(<active locale>)`, and flags the ones elsewhere. US dollar
 * currencies and date pickers from known libraries are flagged with Gulf suggestions. `helper` is the
 * root-relative path of the generated dualkit-locale module.
 */
export function formatEdits(file: SourceFile, lib: Lib, helper: string): FileResult {
  const edits: Edit[] = []
  const flags: Flag[] = []
  for (const block of file.js) {
    const program = block.ast.program as unknown as Node
    const ctx: Context = { file, base: block.offset, lib, helper, edits, flags, hooked: new Map() }
    const before = edits.length
    walk(program, ctx, [])
    if (edits.length === before) continue
    const style = styleOf(program, file.text, ctx.base)
    const imports = bindingEdits(ctx, style)
    const helperImport = { name: 'dkIntlLocale', source: specifierTo(file.path, helper) }
    edits.push(...addImports(program, [...imports, helperImport], ctx.base, style))
  }
  return { edits, flags }
}
