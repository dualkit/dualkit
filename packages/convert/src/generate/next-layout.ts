import { parseSourceOutcome } from '@dualkit/lint'
import { UnsupportedError } from '../project'
import { addImports, type NamedImport } from '../transforms/imports'
import { isOwnHook, styleOf, type Node, type Style } from '../transforms/strings'
import type { Edit, Mode } from '../types'

const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'])
const SKIP = new Set(['loc', 'leadingComments', 'trailingComments', 'innerComments', 'extra'])
const LOOSE_TYPES = new Set(['TSUnionType', 'TSFunctionType', 'TSConditionalType', 'TSConstructorType'])
const PROVIDER = 'NextIntlClientProvider'

/** How to edit the root layout: the routing import specifier, and whether params is a Promise (Next 15 and later). */
export type LayoutOptions = { routing: string; promiseParams: boolean }

type Ctx = { text: string; base: number; style: Style; typed: boolean }

const at = (ctx: Ctx, offset: number, text: string): Edit => ({ start: ctx.base + offset, end: ctx.base + offset, text })

function findElement(node: unknown, name: string): Node | null {
  if (Array.isArray(node)) return node.map((n) => findElement(n, name)).find(Boolean) ?? null
  if (!node || typeof node !== 'object') return null
  const n = node as Node
  if (n.type === 'JSXElement' && ((n.openingElement as Node).name as Node).name === name) return n
  for (const [key, child] of Object.entries(n)) {
    if (SKIP.has(key)) continue
    const found = findElement(child, name)
    if (found) return found
  }
  return null
}

/** The edits that give `<html>` its lang and dir, replacing any it had. */
function htmlEdits(html: Node, mode: Mode, ctx: Ctx): Edit[] {
  const opening = html.openingElement as Node
  const attrs = mode === 'arabic' ? ' lang="ar" dir="rtl"' : " lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}"
  const edits = [at(ctx, (opening.name as Node).end!, attrs)]
  for (const attr of (opening.attributes as Node[]) ?? []) {
    const name = attr.type === 'JSXAttribute' ? (attr.name as Node).name : undefined
    if (name !== 'lang' && name !== 'dir') continue
    let start = ctx.base + attr.start!
    while (/\s/.test(ctx.text[start - 1] ?? '')) start--
    edits.push({ start, end: ctx.base + attr.end!, text: '' })
  }
  return edits
}

/** The edits that wrap the body's children (else the html element's) in the provider. */
function providerEdits(html: Node, ctx: Ctx): Edit[] {
  const body = findElement(html, 'body')
  const holder = body?.closingElement ? body : html
  const closing = holder.closingElement as Node | null
  if (!closing) return []
  return [at(ctx, (holder.openingElement as Node).end!, `<${PROVIDER}>`), at(ctx, closing.start!, `</${PROVIDER}>`)]
}

/** The default-exported layout function. */
function layoutFunction(program: Node): Node | null {
  const body = (program.body as Node[]) ?? []
  const exported = body.find((s) => s.type === 'ExportDefaultDeclaration')?.declaration as Node | undefined
  if (!exported) return null
  if (FUNCTIONS.has(exported.type!)) return exported
  if (exported.type !== 'Identifier') return null
  for (const s of body) {
    const d = s.type === 'ExportNamedDeclaration' ? (s.declaration as Node | null) : s
    if (d?.type === 'FunctionDeclaration' && (d.id as Node).name === exported.name) return d
    for (const v of d?.type === 'VariableDeclaration' ? ((d.declarations as Node[]) ?? []) : []) {
      const init = v.init as Node | null
      if ((v.id as Node).name === exported.name && init && FUNCTIONS.has(init.type!)) return init
    }
  }
  return null
}

const paramsType = (options: LayoutOptions): string =>
  options.promiseParams ? '{ params: Promise<{ locale: string }> }' : '{ params: { locale: string } }'

/** Appends the params type to a parameter's annotation, wrapping loose types in parentheses. */
function annotate(param: Node, options: LayoutOptions, ctx: Ctx): Edit[] {
  const annotation = (param.typeAnnotation as Node | null)?.typeAnnotation as Node | undefined
  if (!annotation) return []
  const extra = ` & ${paramsType(options)}`
  if (!LOOSE_TYPES.has(annotation.type!)) return [at(ctx, annotation.end!, extra)]
  return [at(ctx, annotation.start!, '('), at(ctx, annotation.end!, `)${extra}`)]
}

/** Edits that give the layout a params argument, and the expression that holds params. */
function paramEdits(fn: Node, options: LayoutOptions, ctx: Ctx): { edits: Edit[]; source: string } {
  const [param] = (fn.params as Node[]) ?? []
  if (!param) {
    const open = ctx.text.indexOf('(', ctx.base + ((fn.id as Node | null)?.end ?? fn.start!))
    const type = ctx.typed ? `: ${paramsType(options)}` : ''
    return { edits: [{ start: open + 1, end: open + 1, text: `{ params }${type}` }], source: 'params' }
  }
  if (param.type === 'Identifier') return { edits: annotate(param, options, ctx), source: `${param.name as string}.params` }
  if (param.type !== 'ObjectPattern') throw new UnsupportedError('The root layout takes its props in a form convert cannot add params to. Destructure them as { children }, then run convert again.')
  const first = ((param.properties as Node[]) ?? [])[0]
  const insert = first ? at(ctx, first.start!, 'params, ') : at(ctx, param.start! + 1, ' params ')
  return { edits: [insert, ...annotate(param, options, ctx)], source: 'params' }
}

/** The leading whitespace of the line an offset sits on. */
const indentAt = (text: string, offset: number): string =>
  /^[ \t]*/.exec(text.slice(text.lastIndexOf('\n', offset - 1) + 1, offset))![0]

/** Edits that put statements first in a function body, turning an expression body into a block. */
function prepend(fn: Node, lines: string[], ctx: Ctx): Edit[] {
  const body = fn.body as Node
  if (body.type === 'BlockStatement') {
    const first = ((body.body as Node[]) ?? [])[0]
    if (first) {
      const indent = indentAt(ctx.text, ctx.base + first.start!)
      return [at(ctx, first.start!, lines.map((l) => `${l}\n${indent}`).join(''))]
    }
    const indent = `${indentAt(ctx.text, ctx.base + fn.start!)}  `
    return [at(ctx, body.start! + 1, lines.map((l) => `\n${indent}${l}`).join(''))]
  }
  const extra = body.extra as Node | undefined
  const open = extra?.parenthesized ? (extra.parenStart as number) : body.start!
  const indent = indentAt(ctx.text, ctx.base + fn.start!)
  return [
    at(ctx, open, `{\n${lines.map((l) => `${indent}  ${l}\n`).join('')}${indent}  return `),
    at(ctx, fn.end!, `\n${indent}}`),
  ]
}

/** A `const t = useTranslations()` the strings pass added becomes `await getTranslations()`, since the layout turns async. */
function hookEdits(fn: Node, ctx: Ctx): { edits: Edit[]; imports: NamedImport[] } {
  const body = fn.body as Node
  const statements = body.type === 'BlockStatement' ? ((body.body as Node[]) ?? []) : []
  const hook = statements.find(isOwnHook)
  const init = ((hook?.declarations as Node[] | undefined)?.[0]?.init as Node | undefined)
  if (!init || init.type === 'AwaitExpression') return { edits: [], imports: [] }
  return {
    edits: [{ start: ctx.base + init.start!, end: ctx.base + init.end!, text: 'await getTranslations()' }],
    imports: [{ name: 'getTranslations', source: 'next-intl/server' }],
  }
}

const exportsName = (program: Node, name: string): boolean =>
  ((program.body as Node[]) ?? []).some((s) => {
    const d = s.type === 'ExportNamedDeclaration' ? (s.declaration as Node | null) : null
    if (d?.type === 'FunctionDeclaration') return (d.id as Node).name === name
    if (d?.type === 'VariableDeclaration') return ((d.declarations as Node[]) ?? []).some((v) => (v.id as Node).name === name)
    return s.type === 'ExportNamedDeclaration' && ((s.specifiers as Node[]) ?? []).some((spec) => (spec.exported as Node).name === name)
  })

/** The bilingual edits: async, params, locale check, request locale, and static params for both locales. */
function localeEdits(program: Node, options: LayoutOptions, ctx: Ctx): { edits: Edit[]; imports: NamedImport[] } {
  const fn = layoutFunction(program)
  if (!fn) throw new UnsupportedError('Convert could not find the default export of the root layout, so it cannot read the locale there.')
  const { edits, source } = paramEdits(fn, options, ctx)
  if (!fn.async) edits.push(at(ctx, fn.start!, 'async '))
  const semi = ctx.style.semi
  edits.push(...prepend(fn, [
    `const { locale } = await ${source}${semi}`,
    `if (!hasLocale(routing.locales, locale)) notFound()${semi}`,
    `setRequestLocale(locale)${semi}`,
  ], ctx))
  const hook = hookEdits(fn, ctx)
  edits.push(...hook.edits)
  if (!exportsName(program, 'generateStaticParams')) {
    const end = program.end!
    const lead = ctx.text.slice(0, ctx.base + end).endsWith('\n') ? '\n' : '\n\n'
    edits.push(at(ctx, end, `${lead}export function generateStaticParams() {\n  return routing.locales.map((locale) => ({ locale }))${semi}\n}\n`))
  }
  return {
    edits,
    imports: [
      { name: 'hasLocale', source: 'next-intl' },
      { name: 'setRequestLocale', source: 'next-intl/server' },
      ...hook.imports,
      { name: 'notFound', source: 'next/navigation' },
      { name: 'routing', source: options.routing },
    ],
  }
}

/**
 * The edits that wire the root layout for next-intl: `<html>` gets lang and dir, the body's children are
 * wrapped in NextIntlClientProvider, and in bilingual mode the layout reads and checks the locale from
 * params. Returns no edits when the layout already has the provider. `path` names the file for parsing.
 */
export function layoutEdits(path: string, text: string, mode: Mode, options: LayoutOptions): Edit[] {
  if (text.includes(PROVIDER)) return []
  const outcome = parseSourceOutcome(path, text)
  const block = 'file' in outcome ? outcome.file.js[0] : undefined
  if (!block) throw new UnsupportedError(`Convert could not parse the root layout in ${path}.`)
  const program = block.ast.program as unknown as Node
  if (((program.directives as Node[]) ?? []).some((d) => (d.value as Node).value === 'use client')) {
    throw new UnsupportedError(`The root layout in ${path} is a client component. Convert needs it to be a server component to read the locale.`)
  }
  const html = findElement(program, 'html')
  if (!html) throw new UnsupportedError(`The root layout in ${path} has no <html> element, so convert cannot set the language and direction.`)
  const ctx: Ctx = { text, base: block.offset, style: styleOf(program, text, block.offset), typed: /\.tsx?$/.test(path) }
  const edits = [...htmlEdits(html, mode, ctx), ...providerEdits(html, ctx)]
  const imports: NamedImport[] = [{ name: PROVIDER, source: 'next-intl' }]
  if (mode === 'bilingual') {
    const locale = localeEdits(program, options, ctx)
    edits.push(...locale.edits)
    imports.push(...locale.imports)
  }
  return [...edits, ...addImports(program, imports, ctx.base, ctx.style)]
}
