import { classStrings, parseClass, physicalTokens, sideScoped, type ClassFragment, type ParsedClass, type SourceFile, type TailwindEntry } from '@dualkit/lint'
import type { Edit, FileResult, Flag } from '../types'
import { lineOf } from './lines'

/** The first release with logical margin, padding, inset, rounded, border and scroll classes. */
const FLOOR = '3.3.0'

type Version = [number, number, number]

function parseVersion(text: string | null): Version | null {
  const match = text ? /(\d+)\.(\d+)\.(\d+)/.exec(text) : null
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
}

/** Negative when a is older than b. */
const compareVersions = (a: Version, b: Version): number => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

/** One class with its place in the file. */
type Token = { text: string; at: number; parsed: ParsedClass; fragment: ClassFragment }

const tokensOf = (fragments: readonly ClassFragment[]): Token[] =>
  fragments.flatMap((fragment) =>
    [...fragment.text.matchAll(/\S+/g)].map((m) => ({ text: m[0], at: fragment.offset + m.index, parsed: parseClass(m[0]), fragment })))

const rebuild = (p: ParsedClass, core: string): string => `${p.variants.map((v) => `${v}:`).join('')}${p.important[0]}${p.negative}${core}${p.important[1]}`

/** The entry with the highest since that is not above version. */
function pickEntry(matches: readonly TailwindEntry[], version: Version): TailwindEntry | null {
  const usable = matches
    .map((entry) => ({ entry, since: parseVersion(entry.since)! }))
    .filter(({ since }) => compareVersions(since, version) <= 0)
    .sort((a, b) => compareVersions(b.since, a.since))
  return usable[0]?.entry ?? null
}

function physicalEdits(fragments: readonly ClassFragment[], version: Version): Edit[] {
  return physicalTokens(fragments).flatMap(({ token, at, parsed, matches }) => {
    const replaced = pickEntry(matches, version)?.replace(parsed.core)
    return replaced ? [{ start: at, end: at + token.length, text: rebuild(parsed, replaced) }] : []
  })
}

const KEPT = (t: Token): boolean => t.fragment.deliberate !== true && t.fragment.sided !== true && !sideScoped(t.parsed.variants)

const REVERSIBLE = /^(space|divide)-x(?:-|$)/
const REVERSE = /^(space|divide)-x-reverse$/

/** On v3, space-x-* and divide-x-* need the rtl reverse helper, once per class list. */
function reverseEdits(fragments: readonly ClassFragment[]): Edit[] {
  const tokens = tokensOf(fragments)
  const reversed = new Set(tokens.filter((t) => REVERSE.test(t.parsed.core)).map((t) => REVERSE.exec(t.parsed.core)![1]))
  const edits: Edit[] = []
  for (const t of tokens) {
    const kind = REVERSIBLE.exec(t.parsed.core)?.[1]
    if (!kind || REVERSE.test(t.parsed.core) || !KEPT(t) || reversed.has(kind)) continue
    reversed.add(kind)
    const end = t.at + t.text.length
    edits.push({ start: end, end, text: ` rtl:${kind}-x-reverse` })
  }
  return edits
}

const TRANSLATE_CENTRE = /^translate-x-(?:1\/2|\[-?50%\])$/
const CENTRE_OFFSET = /^(?:left|right|start|end)-(?:1\/2|\[50%\])$/
const CORNERS = '(?:left|right|(?:top|bottom)-(?:left|right)|(?:left|right)-(?:top|bottom))'
const CORNER_SHORT = '(?:l|r|tl|tr|bl|br)'

/** The advice for a class with no logical form, or null when the class is fine. */
function adviceFor(core: string, negative: string, tokens: readonly Token[]): string | null {
  if (/^translate-x-/.test(core)) {
    if (TRANSLATE_CENTRE.test(core) && tokens.some((t) => CENTRE_OFFSET.test(t.parsed.core))) return null
    return `Tailwind has no logical translate. Keep it for centring, or flip it for Arabic with an rtl: variant such as rtl:${negative ? '' : '-'}${core}.`
  }
  if (new RegExp(`^bg-(?:gradient|linear)-to-${CORNER_SHORT}$`).test(core)) return 'A gradient direction stays physical. Add an rtl: variant with the opposite side, such as rtl:bg-gradient-to-l.'
  if (new RegExp(`^origin-${CORNERS}$`).test(core)) return 'A transform origin stays physical. Add an rtl: variant with the opposite side.'
  if (new RegExp(`^(?:bg|object)-${CORNERS}$`).test(core)) return 'A background or object position stays physical. Add an rtl: variant with the opposite side.'
  if (/^rotate-/.test(core) && !/^rotate-0$/.test(core)) return 'A rotation turns the same way in Arabic. If it points an arrow or chevron, add an rtl: variant such as rtl:-rotate-45, or use rtl:scale-x-[-1] to mirror it.'
  if (/^skew-x-/.test(core)) return 'A horizontal skew leans the same way in Arabic. Add an rtl: variant with the opposite sign if it should mirror.'
  return shadowAdvice(core)
}

const OFFSET = /^(-?\d*\.?\d+)(?:px|rem|em)?$/

function shadowAdvice(core: string): string | null {
  const inner = /^shadow-\[(.+)\]$/.exec(core)?.[1]
  if (!inner) return null
  const parts = inner.split('_').filter((p) => p !== 'inset')
  const x = OFFSET.exec(parts[0] ?? '')?.[1]
  return x !== undefined && Number(x) !== 0 ? 'A shadow with a horizontal offset falls on the same side in Arabic. Add an rtl: variant with the offset negated.' : null
}

function formFlags(file: SourceFile, fragments: readonly ClassFragment[]): Flag[] {
  const tokens = tokensOf(fragments)
  return tokens.filter(KEPT).flatMap((t) => {
    const suggestion = adviceFor(t.parsed.core, t.parsed.negative, tokens)
    if (!suggestion) return []
    const message = `\`${t.text}\` has no logical form in Tailwind and stays physical in Arabic.`
    return [{ file: file.path, line: lineOf(file.text, t.at), kind: 'no-logical-form' as const, message, suggestion }]
  })
}

type Walked = { type?: string; start?: number; [key: string]: unknown }
const SKIP = new Set(['loc', 'leadingComments', 'trailingComments', 'innerComments', 'extra'])

function* templatesIn(node: unknown): Generator<Walked> {
  if (Array.isArray(node)) for (const child of node) yield* templatesIn(child)
  if (!node || typeof node !== 'object' || Array.isArray(node)) return
  const n = node as Walked
  if (n.type === 'TemplateLiteral' && Array.isArray(n.expressions) && n.expressions.length > 0) yield n
  for (const [key, child] of Object.entries(n)) if (!SKIP.has(key)) yield* templatesIn(child)
}

function* classAttributes(node: unknown): Generator<Walked> {
  if (Array.isArray(node)) for (const child of node) yield* classAttributes(child)
  if (!node || typeof node !== 'object' || Array.isArray(node)) return
  const n = node as Walked & { name?: { name?: string } }
  if (n.type === 'JSXAttribute' && (n.name?.name === 'className' || n.name?.name === 'class')) yield n
  else for (const [key, child] of Object.entries(n)) if (!SKIP.has(key)) yield* classAttributes(child)
}

/** The names bound to a next/font loader call, such as `geistSans` in `const geistSans = Geist({...})`. */
function fontNames(program: unknown): Set<string> {
  const body = ((program as { body?: Walked[] }).body ?? [])
  const loaders = new Set(body.filter((s) => s.type === 'ImportDeclaration' && /^next\/font\//.test(String((s.source as Walked).value)))
    .flatMap((s) => (s.specifiers as Walked[]).map((spec) => String((spec.local as Walked).name))))
  const names = new Set<string>()
  for (const s of body) {
    const declaration = s.type === 'ExportNamedDeclaration' ? (s.declaration as Walked | null) : s
    if (declaration?.type !== 'VariableDeclaration') continue
    for (const d of declaration.declarations as Walked[]) {
      const init = d.init as Walked | null
      const callee = init?.type === 'CallExpression' ? (init.callee as Walked) : null
      if (callee?.type === 'Identifier' && loaders.has(String(callee.name)) && (d.id as Walked).type === 'Identifier') names.add(String((d.id as Walked).name))
    }
  }
  return names
}

/** Whether an expression is a next/font `.variable` or `.className`, which never holds a physical class. */
const isFontClass = (fonts: Set<string>, e: Walked): boolean => {
  const object = e.object as Walked | undefined
  const property = e.property as Walked | undefined
  return e.type === 'MemberExpression' && !e.computed && object?.type === 'Identifier' && fonts.has(String(object.name))
    && (property?.name === 'variable' || property?.name === 'className')
}

/** One flag per className template literal that holds a `${`, unless every `${}` is a next/font class. Static parts are converted anyway. */
function computedFlags(file: SourceFile): Flag[] {
  const starts = new Set<number>()
  for (const block of file.js) {
    const fonts = fontNames(block.ast.program)
    for (const attr of classAttributes(block.ast.program)) {
      for (const template of templatesIn(attr.value)) {
        if ((template.expressions as Walked[]).every((e) => isFontClass(fonts, e))) continue
        if (template.start !== undefined) starts.add(block.offset + template.start)
      }
    }
  }
  return [...starts].sort((a, b) => a - b).map((at) => ({
    file: file.path,
    line: lineOf(file.text, at),
    kind: 'computed-class' as const,
    message: 'This className is built at run time, so convert cannot see every class in it.',
    suggestion: 'Check it by hand for ml-, mr-, pl-, pr-, left-, right-, text-left and text-right, and use the logical classes.',
  }))
}

function groups(fragments: readonly ClassFragment[]): ClassFragment[][] {
  const byGroup = new Map<number, ClassFragment[]>()
  for (const f of fragments) byGroup.set(f.group, [...(byGroup.get(f.group) ?? []), f])
  return [...byGroup.values()]
}

/**
 * Converts physical Tailwind classes to logical ones for the given Tailwind version, flags classes with
 * no logical form, and flags computed className templates. Below 3.3.0 it edits nothing.
 */
export function tailwindEdits(file: SourceFile, version: string | null): FileResult {
  const parsed = parseVersion(version)
  const fragments = classStrings(file)
  if (!parsed) return { edits: [], flags: [] }
  if (compareVersions(parsed, parseVersion(FLOOR)!) < 0) {
    const first = fragments[0]
    if (!first) return { edits: [], flags: [] }
    const message = `Tailwind ${version} has no logical classes such as ms-4 or text-start. Upgrade Tailwind to 3.3 or later.`
    const suggestion = 'Upgrade Tailwind to 3.3 or later, then run convert again.'
    return { edits: [], flags: [{ file: file.path, line: lineOf(file.text, first.offset), kind: 'unsupported', message, suggestion }] }
  }
  const sources = groups(fragments)
  const edits = sources.flatMap((g) => [...physicalEdits(g, parsed), ...(parsed[0] < 4 ? reverseEdits(g) : [])])
  const flags = [...sources.flatMap((g) => formFlags(file, g)), ...computedFlags(file)]
  return { edits, flags: flags.sort((a, b) => a.line - b.line) }
}
