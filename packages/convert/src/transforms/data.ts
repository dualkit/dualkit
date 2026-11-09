import { dirname, join, normalize } from 'node:path'
import { parseSourceOutcome } from '@dualkit/lint'
import { applyEdits } from '../edits'
import type { LedgerEntry } from '../ledger'
import type { Edit } from '../types'
import { lineOf } from './lines'
import { FUNCTIONS, componentOf, idName, scopeNames, tInScope, type Node } from './scope'
import { hookEdits, importEdits, keyWords, stemOf, styleOf, type Lib } from './strings'

const SKIP = new Set(['loc', 'leadingComments', 'trailingComments', 'innerComments', 'extra'])
const TEXT_KEYS = new Set(['title', 'label', 'description', 'placeholder', 'subtitle', 'message', 'text', 'alt', 'heading', 'caption'])
/** `name` is only text beside one of these, as in a nav item. Elsewhere it is usually a person or an id. */
const NAV_KEYS = new Set(['href', 'url', 'path', 'to', 'icon'])
/** Next reads these exports by name, so they cannot become functions. */
const RESERVED = new Set(['metadata', 'viewport', 'config', 'routing'])
const PROSE = /^\p{Lu}\p{Ll}/u
const NOT_PROSE = /[/\\_=<>{}@#|]/
const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx']
const ALIASES = /^[@~]\//

export type DataInput = { path: string; text: string }
export type DataResult = { texts: Map<string, string>; entries: LedgerEntry[]; moved: number }

type Module = { path: string; text: string; base: number; program: Node }
type Data = { module: Module; name: string; declarator: Node; init: Node; strings: Node[] }
type Use = { module: Module; node: Node; local: string; component: Node }

const unwrap = (node: Node): Node => (node.type === 'TSAsExpression' || node.type === 'TSSatisfiesExpression' ? unwrap(node.expression as Node) : node)

const children = (node: Node): [string, unknown][] => Object.entries(node).filter(([key]) => !SKIP.has(key))

/** Calls visit on every node under `node`, with the nodes above it. */
function visit(node: unknown, ancestors: Node[], fn: (n: Node, above: Node[]) => void): void {
  if (Array.isArray(node)) return node.forEach((child) => visit(child, ancestors, fn))
  if (!node || typeof node !== 'object') return
  const n = node as Node
  if (typeof n.type === 'string') fn(n, ancestors)
  const next = typeof n.type === 'string' ? [...ancestors, n] : ancestors
  for (const [, child] of children(n)) visit(child, next, fn)
}

const keyName = (property: Node): string | null => {
  const key = property.key as Node
  if (property.computed) return null
  return key.type === 'Identifier' ? String(key.name) : key.type === 'StringLiteral' ? String(key.value) : null
}

const isProse = (value: string): boolean => PROSE.test(value) && !NOT_PROSE.test(value)

function textProperty(property: Node, parent: Node | undefined): boolean {
  const key = keyName(property)
  if (key === null) return false
  if (TEXT_KEYS.has(key)) return true
  if (key !== 'name' || parent?.type !== 'ObjectExpression') return false
  return ((parent.properties as Node[]) ?? []).some((p) => p.type === 'ObjectProperty' && NAV_KEYS.has(keyName(p) ?? ''))
}

/** The text a data value holds, outside functions and JSX, or null when a `t` inside it would clash. */
function textsIn(init: Node, reserved: ReadonlySet<string>): Node[] | null {
  const strings: Node[] = []
  let clash = false
  visit(init, [], (node, above) => {
    if (FUNCTIONS.has(node.type!) && scopeNames(node).includes('t')) clash = true
    if (node.type !== 'ObjectProperty' || above.some((a) => FUNCTIONS.has(a.type!) || a.type?.startsWith('JSX'))) return
    const value = node.value as Node
    if (value.type === 'StringLiteral' && isProse(String(value.value)) && !reserved.has(String(value.value)) && textProperty(node, above[above.length - 1])) strings.push(value)
  })
  return clash ? null : strings
}

function dataIn(module: Module, reserved: ReadonlySet<string>): Data[] {
  const found: Data[] = []
  for (const statement of (module.program.body as Node[]) ?? []) {
    const declaration = statement.type === 'ExportNamedDeclaration' ? (statement.declaration as Node | null) : statement
    if (declaration?.type !== 'VariableDeclaration' || declaration.kind !== 'const') continue
    for (const declarator of (declaration.declarations as Node[]) ?? []) {
      const id = declarator.id as Node
      const init = declarator.init as Node | null
      if (id.type !== 'Identifier' || !init || RESERVED.has(String(id.name))) continue
      if (!['ArrayExpression', 'ObjectExpression'].includes(unwrap(init).type!)) continue
      const strings = textsIn(init, reserved)
      if (strings?.length) found.push({ module, name: String(id.name), declarator, init, strings })
    }
  }
  return found
}

const ROUTE_FILE = /(^|[\\/])(page|layout)\.[jt]sx?$/

/** A route file's `export const metadata = { ... }` when it can become a function, else null. Next reads the export by name, so the function takes the name `generateMetadata`. */
function metadataIn(module: Module, reserved: ReadonlySet<string>): { statement: Node; declarator: Node; init: Node; strings: Node[] } | null {
  if (!ROUTE_FILE.test(module.path)) return null
  // A client module cannot export generateMetadata or import from next-intl/server.
  if (((module.program.directives as Node[]) ?? []).some((d) => (d.value as Node).value === 'use client')) return null
  const body = (module.program.body as Node[]) ?? []
  const named = (statement: Node, name: string): boolean => {
    const declaration = statement.type === 'ExportNamedDeclaration' ? (statement.declaration as Node | null) : statement
    if (declaration?.type === 'FunctionDeclaration') return idName(declaration.id as Node) === name
    return declaration?.type === 'VariableDeclaration' && ((declaration.declarations as Node[]) ?? []).some((d) => idName(d.id as Node) === name)
  }
  if (body.some((statement) => named(statement, 'generateMetadata'))) return null
  const statement = body.find((s) => s.type === 'ExportNamedDeclaration' && (s.declaration as Node | null)?.type === 'VariableDeclaration' && named(s, 'metadata'))
  const declaration = statement?.declaration as Node | undefined
  const declarators = (declaration?.declarations as Node[]) ?? []
  const declarator = declarators[0]
  const init = declarator?.init as Node | null | undefined
  if (!statement || declaration?.kind !== 'const' || declarators.length !== 1 || !declarator || init?.type !== 'ObjectExpression') return null
  const id = declarator.id as Node
  let read = false
  visit(module.program, [], (node, above) => {
    if (node.type !== 'Identifier' || node.name !== 'metadata' || node === id) return
    const parent = above[above.length - 1]!
    if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return
    if (parent.type === 'ObjectProperty' && parent.key === node && !parent.computed && !parent.shorthand) return
    read = true
  })
  const strings = read ? null : textsIn(init, reserved)
  return strings?.length ? { statement, declarator, init, strings } : null
}

/** Every string used as a type, as in `type Label = 'Comments' | 'Files'`. Such a value is an id the code checks, not text. */
function literalTypes(modules: Module[]): Set<string> {
  const found = new Set<string>()
  for (const module of modules) {
    visit(module.program, [], (node) => {
      const literal = node.type === 'TSLiteralType' ? (node.literal as Node) : null
      if (literal?.type === 'StringLiteral') found.add(String(literal.value))
    })
  }
  return found
}

/** The project path an import points at, or null for a package. */
function resolve(from: string, source: string, known: ReadonlySet<string>): string | null {
  const bases = source.startsWith('.') ? [join(dirname(from), source)]
    : ALIASES.test(source) ? [source.slice(2), join('src', source.slice(2))] : []
  for (const base of bases) {
    for (const extension of EXTENSIONS) {
      const path = normalize(`${base}${extension}`)
      if (known.has(path)) return path
    }
  }
  return null
}

/** Exports that pass a name through or hide it behind a namespace, which this pass cannot follow. */
function opaque(module: Module, known: ReadonlySet<string>): string[] {
  const paths: string[] = []
  for (const statement of (module.program.body as Node[]) ?? []) {
    const source = statement.source as Node | null | undefined
    if (!source) continue
    const path = resolve(module.path, String(source.value), known)
    if (!path) continue
    const star = ((statement.specifiers as Node[]) ?? []).some((s) => s.type === 'ImportNamespaceSpecifier')
    if (statement.type !== 'ImportDeclaration' || star) paths.push(path)
  }
  return paths
}

/** Where `local` is read in a module. Null when any read cannot take a translated value, so the data stays as it is. */
function usesOf(module: Module, local: string, skip: Node | null, lib: Lib): Use[] | null {
  const uses: Use[] = []
  let blocked = false
  visit(module.program, [], (node, above) => {
    if (blocked || node.type !== 'Identifier' || node.name !== local || node === skip) return
    const parent = above[above.length - 1]!
    if (parent.type?.startsWith('Import') || parent.type === 'TSTypeReference' || parent.type === 'TSQualifiedName') return
    if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return
    if (parent.type === 'OptionalMemberExpression' && parent.property === node && !parent.computed) return
    if (parent.type === 'ObjectProperty' && parent.key === node && !parent.computed && !parent.shorthand) return
    const inner = above.slice(1)
    const shadowed = inner.some((a) => scopeNames(a).includes(local))
    const component = componentOf(above)
    const stuck = parent.type === 'TSTypeQuery' || parent.type?.startsWith('Export') || Boolean(parent.shorthand)
    // The hook runs in the body, so a default value in the parameters cannot see t.
    const inParams = component !== null && node.start! < (component.body as Node).start!
    if (shadowed || stuck || inParams || !component || tInScope(inner) || (lib === 'react-i18next' && component.async)) blocked = true
    else uses.push({ module, node, local, component })
  })
  return blocked ? null : uses
}

/** Every read of a data value across the project, or null when one of them cannot be changed. */
function allUses(data: Data, modules: Module[], known: ReadonlySet<string>, lib: Lib): Use[] | null {
  const own = usesOf(data.module, data.name, data.declarator.id as Node, lib)
  if (!own) return null
  const uses = [...own]
  for (const module of modules) {
    if (module === data.module) continue
    for (const statement of (module.program.body as Node[]) ?? []) {
      if (statement.type !== 'ImportDeclaration' || resolve(module.path, String((statement.source as Node).value), known) !== data.module.path) continue
      const specifier = ((statement.specifiers as Node[]) ?? []).find((s) => s.type === 'ImportSpecifier' && (s.imported as Node).name === data.name)
      if (!specifier) continue
      const found = usesOf(module, String((specifier.local as Node).name), null, lib)
      if (!found) return null
      uses.push(...found)
    }
  }
  return uses.length ? uses : null
}

function parseModule({ path, text }: DataInput): Module | null {
  if (text.includes('use server')) return null
  const outcome = parseSourceOutcome(path, text, path)
  const block = 'file' in outcome ? outcome.file.js[0] : undefined
  return block ? { path, text, base: block.offset, program: block.ast.program as unknown as Node } : null
}

type Keys = { used: Set<string>; byText: Map<string, string> }

function keyFor(keys: Keys, stem: string, en: string): { key: string; isNew: boolean } {
  const known = keys.byText.get(`${stem}\n${en}`)
  if (known) return { key: known, isNew: false }
  const base = `${stem}.${keyWords(en)}`
  let key = base
  for (let n = 2; keys.used.has(key); n++) key = `${base}-${n}`
  keys.used.add(key)
  keys.byText.set(`${stem}\n${en}`, key)
  return { key, isNew: true }
}

/** The edits that turn `const x: T = [...]` into `const x = (t: ...): T => ([...])`, with its strings as `t()` calls. */
function dataEdits(data: Data, keys: Keys, entries: LedgerEntry[]): Edit[] {
  const { module, init, declarator, strings } = data
  const { base, text, path } = module
  const annotation = (declarator.id as Node).typeAnnotation as Node | undefined
  const returns = annotation ? text.slice(base + annotation.start!, base + annotation.end!) : ''
  const edits: Edit[] = [
    { start: base + init.start!, end: base + init.start!, text: `(t: (key: string) => string)${returns} => (` },
    { start: base + init.end!, end: base + init.end!, text: ')' },
    ...(annotation ? [{ start: base + annotation.start!, end: base + annotation.end!, text: '' }] : []),
  ]
  const stem = stemOf(path)
  for (const literal of strings) {
    const en = String(literal.value)
    const { key, isNew } = keyFor(keys, stem, en)
    if (isNew) entries.push({ key, en, ar: '', status: 'pending', file: path, line: lineOf(text, base + literal.start!) })
    edits.push({ start: base + literal.start!, end: base + literal.end!, text: `t('${key}')` })
  }
  return edits
}

/**
 * Moves text in module-level arrays and objects into translation files. Each value becomes a function of `t`, and every
 * read becomes a call inside a component, across files. A value stays as it is unless all of its reads can change.
 */
export function liftData(inputs: DataInput[], lib: Lib, taken: ReadonlySet<string>): DataResult {
  const modules = inputs.map(parseModule).filter((m): m is Module => m !== null)
  const known = new Set(inputs.map((i) => normalize(i.path)))
  const barred = new Set(modules.flatMap((m) => opaque(m, known)))
  const reserved = literalTypes(modules)
  const edits = new Map<Module, Edit[]>()
  const components = new Map<Module, Set<Node>>()
  const entries: LedgerEntry[] = []
  const keys: Keys = { used: new Set(taken), byText: new Map() }
  const push = (module: Module, more: Edit[]): void => { edits.set(module, [...(edits.get(module) ?? []), ...more]) }
  let moved = 0
  for (const data of modules.filter((m) => !barred.has(normalize(m.path))).flatMap((m) => dataIn(m, reserved))) {
    const uses = allUses(data, modules, known, lib)
    if (!uses) continue
    push(data.module, dataEdits(data, keys, entries))
    moved += data.strings.length
    for (const use of uses) {
      push(use.module, [{ start: use.module.base + use.node.end!, end: use.module.base + use.node.end!, text: '(t)' }])
      components.set(use.module, (components.get(use.module) ?? new Set()).add(use.component))
    }
  }
  const serverImports = new Set<Module>()
  for (const module of lib === 'next-intl' ? modules : []) {
    const meta = metadataIn(module, reserved)
    if (!meta) continue
    const { statement, declarator, init, strings } = meta
    const style = styleOf(module.program, module.text, module.base)
    const q = style.quote
    const annotation = (declarator.id as Node).typeAnnotation as Node | undefined
    const type = annotation ? module.text.slice(module.base + (annotation.typeAnnotation as Node).start!, module.base + (annotation.typeAnnotation as Node).end!) : ''
    const stem = stemOf(module.path)
    const metaEdits: Edit[] = [
      { start: module.base + statement.start!, end: module.base + init.start!, text: `export async function generateMetadata()${type ? `: Promise<${type}>` : ''} {\n  const t = await getTranslations()${style.semi}\n  return ` },
      { start: module.base + init.end!, end: module.base + statement.end!, text: `${style.semi}\n}` },
    ]
    for (const literal of strings) {
      const en = String(literal.value)
      const { key, isNew } = keyFor(keys, stem, en)
      if (isNew) entries.push({ key, en, ar: '', status: 'pending', file: module.path, line: lineOf(module.text, module.base + literal.start!) })
      metaEdits.push({ start: module.base + literal.start!, end: module.base + literal.end!, text: `t(${q}${key}${q})` })
    }
    push(module, metaEdits)
    serverImports.add(module)
    moved += strings.length
  }
  // One import call per module, so two insertions never land on the same offset.
  for (const module of new Set([...components.keys(), ...serverImports])) {
    const style = styleOf(module.program, module.text, module.base)
    const hooks = [...(components.get(module) ?? [])].map((fn) => hookEdits(fn, lib, module.text, module.base, style))
    const server = serverImports.has(module) ? [{ name: 'getTranslations', source: 'next-intl/server' }] : []
    const imports = importEdits(module.program, [...hooks.flatMap((h) => h.imports), ...server], module.base, style)
    // Edits at one offset apply in order, so an import inserted at the top of the file goes first.
    edits.set(module, [...imports, ...(edits.get(module) ?? []), ...hooks.flatMap((h) => h.edits)])
  }
  const texts = new Map([...edits].map(([module, list]) => [module.path, applyEdits(module.text, list)]))
  return { texts, entries, moved }
}
