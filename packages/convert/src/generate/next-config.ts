import { parseSourceOutcome } from '@dualkit/lint'
import { UnsupportedError } from '../project'
import { styleOf, type Node } from '../transforms/strings'
import type { Edit } from '../types'

const CANDIDATES = ['next.config.ts', 'next.config.mts', 'next.config.mjs', 'next.config.js', 'next.config.cjs']
const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'])
const PLUGIN = 'createNextIntlPlugin'

/** The next.config written when the app has none. */
export const NEW_CONFIG = `import ${PLUGIN} from 'next-intl/plugin'

const withNextIntl = ${PLUGIN}()

/** @type {import('next').NextConfig} */
const nextConfig = {}

export default withNextIntl(nextConfig)
`

const refuse = (path: string): UnsupportedError =>
  new UnsupportedError(`Convert could not find the config object ${path} exports, so it cannot add the next-intl plugin. Export the object directly, then run convert again.`)

const isModuleExports = (left: Node): boolean =>
  left.type === 'MemberExpression' && (left.object as Node).name === 'module' && (left.property as Node).name === 'exports'

/** Edits that wrap an ES module config's default export. */
function esmEdits(program: Node, value: Node, base: number, semi: string, quote: string): Edit[] {
  const lines = `import ${PLUGIN} from ${quote}next-intl/plugin${quote}${semi}\n\nconst withNextIntl = ${PLUGIN}()${semi}`
  const last = ((program.body as Node[]) ?? []).filter((s) => s.type === 'ImportDeclaration').at(-1)
  const head: Edit = last
    ? { start: base + last.end!, end: base + last.end!, text: `\n${lines}` }
    : { start: base, end: base, text: `${lines}\n\n` }
  return [head, { start: base + value.start!, end: base + value.start!, text: 'withNextIntl(' }, { start: base + value.end!, end: base + value.end!, text: ')' }]
}

/** Edits that wrap a CommonJS config's `module.exports`. */
function cjsEdits(program: Node, value: Node, base: number, semi: string, quote: string): Edit[] {
  const first = ((program.body as Node[]) ?? [])[0]!
  const start = base + Math.min(first.start!, ...((first.leadingComments as Node[] | undefined) ?? []).map((c) => c.start!))
  const lines = `const ${PLUGIN} = require(${quote}next-intl/plugin${quote})${semi}\nconst withNextIntl = ${PLUGIN}()${semi}\n\n`
  return [{ start, end: start, text: lines }, { start: base + value.start!, end: base + value.start!, text: 'withNextIntl(' }, { start: base + value.end!, end: base + value.end!, text: ')' }]
}

/** Edits that wrap one config file's exported object with createNextIntlPlugin, or none when it is already wrapped. */
function configEdits(path: string, text: string): Edit[] {
  if (text.includes(PLUGIN)) return []
  const outcome = parseSourceOutcome(path, text)
  const block = 'file' in outcome ? outcome.file.js[0] : undefined
  if (!block) throw refuse(path)
  const program = block.ast.program as unknown as Node
  const { semi, quote } = styleOf(program, text, block.offset)
  const body = (program.body as Node[]) ?? []
  const esm = body.find((s) => s.type === 'ExportDefaultDeclaration')?.declaration as Node | undefined
  if (esm) {
    if (FUNCTIONS.has(esm.type!) || esm.type === 'ClassDeclaration') throw refuse(path)
    return esmEdits(program, esm, block.offset, semi, quote)
  }
  const assign = body.map((s) => (s.type === 'ExpressionStatement' ? (s.expression as Node) : null))
    .find((e) => e?.type === 'AssignmentExpression' && isModuleExports(e.left as Node))
  const value = assign?.right as Node | undefined
  if (!value || FUNCTIONS.has(value.type!)) throw refuse(path)
  return cjsEdits(program, value, block.offset, semi, quote)
}

/** The next.config change: edits to the app's config, or a new next.config.mjs when it has none. */
export function nextConfigPlan(files: (rel: string) => string | null): { writes: Record<string, string>; edits: Record<string, Edit[]> } {
  const path = CANDIDATES.find((c) => files(c) !== null)
  if (!path) return { writes: { 'next.config.mjs': NEW_CONFIG }, edits: {} }
  const edits = configEdits(path, files(path)!)
  return { writes: {}, edits: edits.length ? { [path]: edits } : {} }
}
