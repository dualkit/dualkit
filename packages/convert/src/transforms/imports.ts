import { posix } from 'node:path'
import type { Node, Style } from './strings'
import type { Edit } from '../types'

/** A named import a generated edit needs. */
export type NamedImport = { name: string; source: string }

const namedOf = (s: Node): string[] =>
  ((s.specifiers as Node[]) ?? []).filter((spec) => spec.type === 'ImportSpecifier')
    .map((spec) => ((spec.imported as Node).name ?? (spec.imported as Node).value) as string)

const importsOf = (program: Node): Node[] =>
  ((program.body as Node[]) ?? []).filter((s) => s.type === 'ImportDeclaration' && s.importKind !== 'type')

/**
 * Edits that add each missing named import: merged into an existing named import from the same
 * source, else one new line per source after the last import, else after the directives, else at the top.
 */
export function addImports(program: Node, wanted: NamedImport[], base: number, style: Style): Edit[] {
  const imports = importsOf(program)
  const bySource = new Map<string, string[]>()
  for (const w of wanted) {
    const known = imports.some((s) => (s.source as Node).value === w.source && namedOf(s).includes(w.name))
    const list = bySource.get(w.source) ?? []
    if (!known && !list.includes(w.name)) bySource.set(w.source, [...list, w.name])
  }
  const edits: Edit[] = []
  const lines: string[] = []
  for (const [source, names] of bySource) {
    if (!names.length) continue
    const merge = imports.find((s) => (s.source as Node).value === source && namedOf(s).length)
    if (merge) {
      const last = ((merge.specifiers as Node[]) ?? []).at(-1)!
      edits.push({ start: base + last.end!, end: base + last.end!, text: names.map((n) => `, ${n}`).join('') })
    } else lines.push(`import { ${names.join(', ')} } from ${style.quote}${source}${style.quote}${style.semi}`)
  }
  return lines.length ? [...edits, linesEdit(program, lines, base)] : edits
}

/** One edit that adds import lines after the last import, else after the directives, else at the top. */
function linesEdit(program: Node, lines: string[], base: number): Edit {
  const anchor = ((program.body as Node[]) ?? []).filter((s) => s.type === 'ImportDeclaration').at(-1)
    ?? ((program.directives as Node[]) ?? []).at(-1)
  if (!anchor) return { start: base, end: base, text: lines.map((l) => `${l}\n`).join('') }
  const at = base + anchor.end!
  return { start: at, end: at, text: lines.map((l) => `\n${l}`).join('') }
}

/** An edit that adds a side-effect import such as `import './i18n'`. */
export const sideEffectImport = (program: Node, source: string, base: number, style: Style): Edit =>
  linesEdit(program, [`import ${style.quote}${source}${style.quote}${style.semi}`], base)

/** The relative module specifier from one root-relative file to another, without a .ts or .tsx extension. */
export function specifierTo(from: string, to: string): string {
  const rel = posix.relative(posix.dirname(from), to).replace(/\.(tsx?|jsx?)$/, '')
  return rel.startsWith('.') ? rel : `./${rel}`
}
