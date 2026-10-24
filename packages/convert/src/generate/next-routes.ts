import { parseSourceOutcome } from '@dualkit/lint'
import { posix } from 'node:path'
import type { Node } from '../transforms/strings'
import { lineOf } from '../transforms/lines'
import type { Edit, Flag } from '../types'
import { resolveAlias, resolveFile, type Alias } from './aliases'

const SKIP = new Set(['loc', 'leadingComments', 'trailingComments', 'innerComments', 'extra'])
const CODE = /\.(tsx?|jsx?|mjs|cjs|mts|cts)$/
const MOVED = /\.(tsx?|jsx?|mjs|cjs|mts|cts|mdx?)$/
const PAGE = /^page\.(tsx?|jsx?|mdx?)$/
/** Files that only work at the app root. Not-found moves under [locale] like any route; global-error stays. */
const ROOT_KEPT = /^(favicon\.ico|global-error\.[jt]sx?|(icon|apple-icon|opengraph-image|twitter-image)\d*(\.alt)?\.\w+|robots\.\w+|sitemap\.\w+|manifest\.\w+)$/
/** Image metadata files, which belong to their segment and so move with it. */
const SEGMENT_METADATA = /^(icon|apple-icon|opengraph-image|twitter-image)\d*(\.alt)?\.\w+$/
/** URL segments the middleware matcher skips, so routes under them must stay where they are. */
const UNMATCHED = /^(api|_next|_vercel)$/

/** The `[locale]` path of a file under the app dir. */
export const localePath = (appDir: string, path: string): string => `${appDir}/[locale]/${path.slice(appDir.length + 1)}`

/** The URL segments of a path under the app dir: route groups and parallel slots are left out. */
export const urlSegments = (dirs: string[]): string[] => dirs.filter((d) => !/^\(.*\)$/.test(d) && !d.startsWith('@'))

type Fate = 'move' | 'kept-route' | 'stay'

/** What happens to a file: code and segment image metadata move, routes the middleware skips are kept, the rest stays. */
function fateOf(appDir: string, path: string): Fate {
  if (!path.startsWith(`${appDir}/`)) return 'stay'
  const parts = path.slice(appDir.length + 1).split('/')
  const name = parts.pop()!
  if (parts[0] === '[locale]') return 'stay'
  const url = urlSegments(parts)
  if ((url[0] && UNMATCHED.test(url[0])) || url.some((d) => d.includes('.') && !d.startsWith('['))) return 'kept-route'
  if (!parts.length && ROOT_KEPT.test(name)) return 'stay'
  return MOVED.test(name) || (parts.length > 0 && SEGMENT_METADATA.test(name)) ? 'move' : 'stay'
}

/** The moves that put the app's routes under `[locale]`, and the pages left outside it because the middleware skips their path. */
export function routeMoves(appDir: string, paths: readonly string[]): { moves: [string, string][]; keptPages: string[] } {
  const moves: [string, string][] = []
  const keptPages: string[] = []
  for (const p of paths) {
    const fate = fateOf(appDir, p)
    if (fate === 'move') moves.push([p, localePath(appDir, p)])
    if (fate === 'kept-route' && PAGE.test(posix.basename(p))) keptPages.push(p)
  }
  return { moves, keptPages }
}

function eachNode(node: unknown, visit: (n: Node) => void): void {
  if (Array.isArray(node)) return node.forEach((child) => eachNode(child, visit))
  if (!node || typeof node !== 'object') return
  const n = node as Node
  if (typeof n.type === 'string') visit(n)
  for (const [key, child] of Object.entries(n)) if (!SKIP.has(key)) eachNode(child, visit)
}

const RELATIVE = /^\.\.?\//
const stringLiteral = (node: Node | undefined): Node | null => (node?.type === 'StringLiteral' ? node : null)

/** The local names of the default import from next/font/local. */
const localFontNames = (program: Node): Set<string> =>
  new Set(((program.body as Node[]) ?? []).filter((s) => s.type === 'ImportDeclaration' && (s.source as Node).value === 'next/font/local')
    .flatMap((s) => ((s.specifiers as Node[]) ?? []).filter((spec) => spec.type === 'ImportDefaultSpecifier').map((spec) => (spec.local as Node).name as string)))

/** Module specifiers (import and export sources, dynamic imports, requires) and relative next/font/local sources. */
function specifierLiterals(program: Node): Node[] {
  const fonts = localFontNames(program)
  const found: Node[] = []
  eachNode(program, (n) => {
    if (/^(Import|ExportNamed|ExportAll)Declaration$/.test(n.type!)) {
      const hit = stringLiteral(n.source as Node | undefined)
      if (hit) found.push(hit)
      return
    }
    if (n.type !== 'CallExpression') return
    const callee = n.callee as Node
    const args = (n.arguments as Node[]) ?? []
    if (callee.type === 'Import' || (callee.type === 'Identifier' && callee.name === 'require')) {
      const hit = stringLiteral(args[0])
      if (hit) found.push(hit)
    } else if (callee.type === 'Identifier' && fonts.has(callee.name as string)) {
      eachNode(args[0], (inner) => { const hit = stringLiteral(inner); if (hit && RELATIVE.test(String(hit.value))) found.push(hit) })
    }
  })
  return found
}

type Scope = { appDir: string; moved: Map<string, string>; has: (path: string) => boolean; aliases: Alias[] }

/** Where a module path points after the moves: under `[locale]` when its file moved, else unchanged. */
const newTarget = (scope: Scope, target: string): string =>
  resolveFile(target, (p) => scope.moved.has(p)) ? localePath(scope.appDir, target) : target

/** The new text of a relative specifier, or null when it still points at the same file. */
function relativeSpec(scope: Scope, from: string, to: string, spec: string): string | null {
  const target = posix.join(posix.dirname(from), spec)
  let next = posix.relative(posix.dirname(to), newTarget(scope, target))
  if (!next.startsWith('.')) next = `./${next}`
  if (spec.endsWith('/') && !next.endsWith('/')) next += '/'
  return posix.normalize(next) === posix.normalize(spec) ? null : next
}

/** The new text of an aliased specifier that resolves to a moved file, in the same alias form; null when unchanged; `stuck` when its alias cannot name the new path. */
function aliasSpec(scope: Scope, spec: string): string | null | 'stuck' {
  const resolved = resolveAlias(spec, scope.aliases, scope.has)
  if (!resolved || !scope.moved.has(resolved.file)) return null
  return resolved.respell(localePath(scope.appDir, resolved.path)) ?? 'stuck'
}

const stuckFlag = (file: string, line: number, spec: string): Flag => ({
  file, line, kind: 'unsupported',
  message: `The import "${spec}" uses a path alias with no * that points at a file convert moved under [locale], so it still points at the old path.`,
  suggestion: 'Point that alias in tsconfig.json at the new path, or import the file by a relative path.',
})

/** Next's typed route helpers, whose first type argument is the route of the file. */
const ROUTE_TYPES = new Set(['PageProps', 'LayoutProps', 'RouteContext'])

/** The route literals in `PageProps<'/x'>` and its kin, which name the route the file had before it moved. */
function routeTypeLiterals(program: Node): Node[] {
  const found: Node[] = []
  eachNode(program, (n) => {
    if (n.type !== 'TSTypeReference') return
    const name = n.typeName as Node
    const args = ((n.typeParameters ?? n.typeArguments) as Node | undefined)?.params as Node[] | undefined
    const literal = (args?.[0]?.type === 'TSLiteralType' ? args[0].literal : undefined) as Node | undefined
    if (name.type === 'Identifier' && ROUTE_TYPES.has(name.name as string) && literal?.type === 'StringLiteral' && String(literal.value).startsWith('/')) found.push(literal)
  })
  return found
}

/** The edits that put a moved file's typed route under `/[locale]`. */
function routeTypeEdits(program: Node, offset: number): Edit[] {
  return routeTypeLiterals(program).map((node) => {
    const route = String(node.value)
    return { start: offset + node.start! + 1, end: offset + node.end! - 1, text: route === '/' ? '/[locale]' : `/[locale]${route}` }
  })
}

/** The edits that keep one file's specifiers pointing at the same files after the moves, its typed routes right, and flags for imports it cannot fix. */
function fileRewrites(scope: Scope, from: string, to: string, text: string): { edits: Edit[]; flags: Flag[] } {
  const outcome = parseSourceOutcome(from, text)
  const block = 'file' in outcome ? outcome.file.js[0] : undefined
  if (!block) return { edits: [], flags: [] }
  const edits: Edit[] = from === to ? [] : routeTypeEdits(block.ast.program as unknown as Node, block.offset)
  const flags: Flag[] = []
  for (const node of specifierLiterals(block.ast.program as unknown as Node)) {
    const spec = String(node.value)
    const next = RELATIVE.test(spec) ? relativeSpec(scope, from, to, spec) : aliasSpec(scope, spec)
    if (next === 'stuck') flags.push(stuckFlag(to, lineOf(text, block.offset + node.start!), spec))
    else if (next !== null && next !== spec) edits.push({ start: block.offset + node.start! + 1, end: block.offset + node.end! - 1, text: next })
  }
  return { edits, flags }
}

/**
 * Edits, keyed by post-move path, that keep every relative import, path alias import and font path working
 * after the moves, and flags for alias imports that cannot follow a moved file.
 */
export function importRewrites(appDir: string, moveList: [string, string][], paths: readonly string[], files: (rel: string) => string | null, aliases: Alias[]): { edits: Record<string, Edit[]>; flags: Flag[] } {
  const known = new Set(paths)
  const scope: Scope = { appDir, moved: new Map(moveList), has: (p) => known.has(p), aliases }
  const edits: Record<string, Edit[]> = {}
  const flags: Flag[] = []
  for (const path of paths) {
    if (!CODE.test(path)) continue
    const text = files(path)
    if (text === null) continue
    const to = scope.moved.get(path) ?? path
    const result = fileRewrites(scope, path, to, text)
    if (result.edits.length) edits[to] = result.edits
    flags.push(...result.flags)
  }
  return { edits, flags }
}
