import { parseSourceOutcome } from '@dualkit/lint'
import { posix } from 'node:path'
import type { Node } from '../transforms/strings'
import type { Edit } from '../types'

const SKIP = new Set(['loc', 'leadingComments', 'trailingComments', 'innerComments', 'extra'])
const CODE = /\.(tsx?|jsx?|mjs|cjs|mts|cts)$/
const MOVED = /\.(tsx?|jsx?|mjs|cjs|mts|cts|mdx?)$/
const EXTENSIONS = ['', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs', '.mts', '.cts']
/** Files that only work at the app root, or that convert's ruling keeps there. */
const ROOT_KEPT = /^(favicon\.ico|not-found\.[jt]sx?|global-error\.[jt]sx?|(icon|apple-icon|opengraph-image|twitter-image)\d*(\.alt)?\.\w+|robots\.\w+|sitemap\.\w+|manifest\.\w+)$/
/** Image metadata files, which belong to their segment and so move with it. */
const SEGMENT_METADATA = /^(icon|apple-icon|opengraph-image|twitter-image)\d*(\.alt)?\.\w+$/
/** URL segments the middleware matcher skips, so routes under them must stay where they are. */
const UNMATCHED = /^(api|_next|_vercel)/

/** The `[locale]` path of a file under the app dir. */
export const localePath = (appDir: string, path: string): string => `${appDir}/[locale]/${path.slice(appDir.length + 1)}`

/** Whether a file under the app dir moves under `[locale]`: code and segment image metadata do, api routes, root-only files and assets do not. */
function moves(appDir: string, path: string): boolean {
  if (!path.startsWith(`${appDir}/`)) return false
  const parts = path.slice(appDir.length + 1).split('/')
  const name = parts.pop()!
  if (parts[0] === '[locale]') return false
  const url = parts.filter((d) => !/^\(.*\)$/.test(d) && !d.startsWith('@'))
  if (url[0] && UNMATCHED.test(url[0])) return false
  if (url.some((d) => d.includes('.'))) return false
  if (!parts.length && ROOT_KEPT.test(name)) return false
  return MOVED.test(name) || (parts.length > 0 && SEGMENT_METADATA.test(name))
}

/** Every move that puts the app's routes under `app/[locale]/`. */
export function routeMoves(appDir: string, paths: readonly string[]): [string, string][] {
  return paths.filter((p) => moves(appDir, p)).map((p) => [p, localePath(appDir, p)])
}

function eachNode(node: unknown, visit: (n: Node) => void): void {
  if (Array.isArray(node)) return node.forEach((child) => eachNode(child, visit))
  if (!node || typeof node !== 'object') return
  const n = node as Node
  if (typeof n.type === 'string') visit(n)
  for (const [key, child] of Object.entries(n)) if (!SKIP.has(key)) eachNode(child, visit)
}

const literal = (node: Node | undefined): Node | null =>
  node?.type === 'StringLiteral' && /^\.\.?\//.test(String(node.value)) ? node : null

/** The local names of the default import from next/font/local. */
const localFontNames = (program: Node): Set<string> =>
  new Set(((program.body as Node[]) ?? []).filter((s) => s.type === 'ImportDeclaration' && (s.source as Node).value === 'next/font/local')
    .flatMap((s) => ((s.specifiers as Node[]) ?? []).filter((spec) => spec.type === 'ImportDefaultSpecifier').map((spec) => (spec.local as Node).name as string)))

/** Relative path strings in a file: import and export sources, dynamic imports, requires, and next/font/local sources. */
function relativeLiterals(program: Node): Node[] {
  const fonts = localFontNames(program)
  const found: Node[] = []
  eachNode(program, (n) => {
    if (/^(Import|ExportNamed|ExportAll)Declaration$/.test(n.type!)) {
      const hit = literal(n.source as Node | undefined)
      if (hit) found.push(hit)
      return
    }
    if (n.type !== 'CallExpression') return
    const callee = n.callee as Node
    const args = (n.arguments as Node[]) ?? []
    const isLoader = callee.type === 'Import' || (callee.type === 'Identifier' && callee.name === 'require')
    if (isLoader) {
      const hit = literal(args[0])
      if (hit) found.push(hit)
    } else if (callee.type === 'Identifier' && fonts.has(callee.name as string)) {
      eachNode(args[0], (inner) => { const hit = literal(inner); if (hit) found.push(hit) })
    }
  })
  return found
}

/** The moved file a resolved import target refers to, trying the usual extensions and index files. */
function movedTarget(target: string, moved: Map<string, string>): string | null {
  const stem = target.replace(/\.(js|jsx|mjs|cjs)$/, '')
  const candidates = [target, ...EXTENSIONS.map((e) => `${stem}${e}`), ...EXTENSIONS.slice(1).map((e) => `${target}/index${e}`)]
  return candidates.find((c) => moved.has(c)) ?? null
}

/** Where a target lives after the moves: under `[locale]` when it or its file moved, else unchanged. */
function newTarget(appDir: string, target: string, moved: Map<string, string>): string {
  return movedTarget(target, moved) ? localePath(appDir, target) : target
}

/** The edits that keep one file's relative paths pointing at the same files after the moves. */
function fileRewrites(appDir: string, from: string, to: string, text: string, moved: Map<string, string>): Edit[] {
  const outcome = parseSourceOutcome(from, text)
  const block = 'file' in outcome ? outcome.file.js[0] : undefined
  if (!block) return []
  const edits: Edit[] = []
  for (const node of relativeLiterals(block.ast.program as unknown as Node)) {
    const spec = String(node.value)
    const target = posix.join(posix.dirname(from), spec)
    let next = posix.relative(posix.dirname(to), newTarget(appDir, target, moved))
    if (!next.startsWith('.')) next = `./${next}`
    if (spec.endsWith('/') && !next.endsWith('/')) next += '/'
    if (posix.normalize(next) === posix.normalize(spec)) continue
    edits.push({ start: block.offset + node.start! + 1, end: block.offset + node.end! - 1, text: next })
  }
  return edits
}

/** Edits, keyed by post-move path, that keep every relative import and font path working after the moves. */
export function importRewrites(appDir: string, moveList: [string, string][], paths: readonly string[], files: (rel: string) => string | null): Record<string, Edit[]> {
  const moved = new Map(moveList)
  const out: Record<string, Edit[]> = {}
  for (const path of paths) {
    if (!CODE.test(path)) continue
    const text = files(path)
    if (text === null) continue
    const to = moved.get(path) ?? path
    const edits = fileRewrites(appDir, path, to, text, moved)
    if (edits.length) out[to] = edits
  }
  return out
}
