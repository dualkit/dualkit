import { coerce, compare, intersects, lt, type SemVer } from 'semver'
import { classStrings, type ClassFragment } from '../classes'
import type { LintHit, LintRule } from '../types'

export type TailwindEntry = { pattern: RegExp; replace: (cls: string) => string | null; since: string }

/**
 * A spacing or inset value Tailwind accepts: a number, a fraction, px, auto, full, an arbitrary [value]
 * or a v4 (--var). Anything else, such as left-panel or right-sidebar, is a project class, not Tailwind.
 */
const VALUE = String.raw`(?:\d+(?:\.\d+)?|\d+\/\d+|px|auto|full|\[.+\]|\(.+\))`

/** cls is the utility alone: no variants, no ! and no leading minus. */
const prefix = (from: string, to: string, since: string): TailwindEntry => ({
  pattern: new RegExp(`^${from}-${VALUE}$`),
  replace: (cls) => `${to}${cls.slice(from.length)}`,
  since,
})
const exact = (from: string, to: string, since: string): TailwindEntry => ({ pattern: new RegExp(`^${from}$`), replace: () => to, since })
const sided = (base: string, sides: Readonly<Record<string, string>>, since: string): TailwindEntry => {
  const pattern = new RegExp(`^${base}-(${Object.keys(sides).join('|')})(-.+)?$`)
  return { pattern, replace: (cls) => cls.replace(pattern, (_, side: string, rest = '') => `${base}-${sides[side]}${rest}`), since }
}

/**
 * Physical Tailwind classes and their logical replacements, from the VERIFIED rows of
 * docs/research/2026-10-20-rules-facts.md section 10a. since is the first release with the logical class.
 * left-* and right-* have two entries: start-* and end-* from 3.3.0, then inset-s-* and inset-e-* from 4.2.0.
 * space-x-* and divide-x-* have no logical replacement and no entry.
 */
export const TAILWIND_MAP: readonly TailwindEntry[] = [
  prefix('ml', 'ms', '3.3.0'), prefix('mr', 'me', '3.3.0'),
  prefix('pl', 'ps', '3.3.0'), prefix('pr', 'pe', '3.3.0'),
  prefix('left', 'start', '3.3.0'), prefix('left', 'inset-s', '4.2.0'),
  prefix('right', 'end', '3.3.0'), prefix('right', 'inset-e', '4.2.0'),
  exact('text-left', 'text-start', '3.1.0'), exact('text-right', 'text-end', '3.1.0'),
  sided('rounded', { l: 's', r: 'e', tl: 'ss', tr: 'se', bl: 'es', br: 'ee' }, '3.3.0'),
  sided('border', { l: 's', r: 'e' }, '3.3.0'),
  exact('float-left', 'float-start', '3.4.0'), exact('float-right', 'float-end', '3.4.0'),
  exact('clear-left', 'clear-start', '3.4.0'), exact('clear-right', 'clear-end', '3.4.0'),
  prefix('scroll-ml', 'scroll-ms', '3.3.0'), prefix('scroll-mr', 'scroll-me', '3.3.0'),
  prefix('scroll-pl', 'scroll-ps', '3.3.0'), prefix('scroll-pr', 'scroll-pe', '3.3.0'),
]

/** The first release with any of the margin, padding, inset, rounded, border and scroll logical classes. Below it the rule is quiet. */
const FLOOR = '3.3.0'

type ParsedClass = { variants: string[]; important: [string, string]; negative: string; core: string }

/** Splits at every : outside brackets and parentheses, so [&:dir(rtl)]:ml-2 keeps its arbitrary variant whole. */
function splitVariants(token: string): string[] {
  const parts: string[] = []
  let depth = 0
  let from = 0
  for (let i = 0; i < token.length; i++) {
    const ch = token[i]
    if (ch === '[' || ch === '(') depth++
    else if ((ch === ']' || ch === ')') && depth > 0) depth--
    else if (ch === ':' && depth === 0) {
      parts.push(token.slice(from, i))
      from = i + 1
    }
  }
  parts.push(token.slice(from))
  return parts
}

const UTILITY = /^(!?)(-?)(.*?)(!?)$/

function parseClass(token: string): ParsedClass {
  const parts = splitVariants(token)
  const utility = parts.pop() ?? ''
  const [, pre = '', negative = '', core = '', post = ''] = UTILITY.exec(utility) ?? []
  return { variants: parts, important: [pre, post], negative, core }
}

/**
 * rtl, ltr, left or right as a whole word anywhere in a variant: rtl:, group-[dir=rtl]:, [dir=rtl]_&:,
 * [&:dir(rtl)]:, data-[side=left]:. Under such a variant the side is chosen on purpose.
 */
const SIDED_VARIANT = /(^|[^a-z0-9])(rtl|ltr|left|right)(?![a-z0-9])/i
const sideScoped = (variants: readonly string[]): boolean => variants.some((v) => SIDED_VARIANT.test(v))

/** rtl or ltr as a whole word in a variant: an explicit direction override. */
const DIRECTION_VARIANT = /(^|[^a-z0-9])(rtl|ltr)(?![a-z0-9])/i

/** Class families an rtl: or ltr: override can redo. Order matters: scroll-* before margin and padding. */
const FAMILIES: readonly [string, RegExp][] = [
  ['scroll-margin', /^scroll-m[xylrsetb]?-/],
  ['scroll-padding', /^scroll-p[xylrsetb]?-/],
  ['margin', /^m[xylrsetb]?-/],
  ['padding', /^p[xylrsetb]?-/],
  ['inset', /^(?:left|right|start|end|inset(?:-[xyse])?)-/],
  ['rounded', /^rounded(?:-|$)/],
  ['border', /^border-[lrsex](?:-|$)/],
  ['text-align', /^text-(?:left|right|start|end|center|justify)$/],
  ['float-clear', /^(?:float|clear)-/],
]
const familyOf = (core: string): string | null => FAMILIES.find(([, re]) => re.test(core))?.[0] ?? null

/** The side word in a physical class, so it can be mirrored. */
const SIDE = /^((?:scroll-)?[mp]|rounded-[tb]?|border-|text-|float-|clear-|)(left|right|l|r)(?=-|$)/
const SWAP: Readonly<Record<string, string>> = { left: 'right', right: 'left', l: 'r', r: 'l' }
const sideOf = (core: string): string | null => SIDE.exec(core)?.[2] ?? null
const mirror = (core: string): string => core.replace(SIDE, (_, head: string, side: string) => `${head}${SWAP[side]}`)

const key = (variants: readonly string[], negative: string, core: string): string => `${variants.join(':')}|${negative}|${core}`

/** left-1/2 with a 50% x translate centres the box in either direction. */
const HALF = new Set(['1/2', '[50%]'])
/** Cores only, so -translate-x-1/2 and translate-x-1/2 both arrive as translate-x-1/2. */
const HALF_TRANSLATES = ['translate-x-1/2', 'translate-x-[50%]', 'translate-x-[-50%]']
const isCentring = (core: string, present: (core: string) => boolean): boolean => {
  const match = /^(?:left|right)-(.+)$/.exec(core)
  return match !== null && HALF.has(match[1]!) && HALF_TRANSLATES.some(present)
}

/** -left-[9999px] or right-[-9999px]: far offscreen on either side, as in physical-css. */
const OFFSCREEN = /^(?:left|right)-\[(-?)(\d+(?:\.\d+)?)[a-z%]*\]$/
const OFFSCREEN_MIN = 999
const isOffscreen = (negative: string, core: string): boolean => {
  const match = OFFSCREEN.exec(core)
  return match !== null && (negative === '-') !== (match[1] === '-') && Number(match[2]) >= OFFSCREEN_MIN
}

/** The release that renamed start-* and end-* to inset-s-* and inset-e-*. */
const INSET_RENAME = '4.2.0'

/** A declared range that allows releases on both sides of 4.2, such as ^4, so either name may be right. */
function spansRename(range: string | null | undefined): boolean {
  if (!range) return false
  try {
    return intersects(range, `<${INSET_RENAME}`) && intersects(range, `>=${INSET_RENAME}`)
  } catch {
    return false
  }
}

function messageFor(token: string, parsed: ParsedClass, matches: readonly TailwindEntry[], version: SemVer, bothNames: boolean): string {
  const side = sideOf(parsed.core)?.startsWith('l') ? 'left' : 'right'
  const usable = matches.filter((e) => !lt(version, e.since)).sort((a, b) => compare(b.since, a.since))
  const entry = usable[0]
  const replaced = entry?.replace(parsed.core)
  if (!entry || !replaced) {
    const first = matches.map((e) => e.since).sort(compare)[0]
    return `\`${token}\` stays on the ${side} in Arabic. Tailwind ${first} adds a logical class for it; until then use the logical CSS property.`
  }
  const prefix = parsed.variants.map((v) => `${v}:`).join('')
  const write = (core: string): string => `${prefix}${parsed.important[0]}${parsed.negative}${core}${parsed.important[1]}`
  const older = matches.find((e) => e.since !== INSET_RENAME && lt(e.since, INSET_RENAME))
  const newer = matches.find((e) => e.since === INSET_RENAME)
  if (bothNames && older && newer && !lt(version, older.since)) {
    const [a, b] = [older.replace(parsed.core), newer.replace(parsed.core)]
    if (a && b) return `\`${token}\` stays on the ${side} in Arabic. Use \`${write(a)}\` (or \`${write(b)}\` from Tailwind 4.2).`
  }
  return `\`${token}\` stays on the ${side} in Arabic. Use \`${write(replaced)}\`.`
}

type Placed = { fragment: number; conditional: boolean }

/**
 * Two classes count as one symmetric pair, or as left-1/2 with its translate, only when both always apply
 * together: they share a fragment, or both sit in unconditional fragments of the source.
 */
const together = (a: Placed, b: Placed): boolean => a.fragment === b.fragment || (!a.conditional && !b.conditional)

const index = (entries: readonly [string, Placed][]): Map<string, Placed[]> => {
  const map = new Map<string, Placed[]>()
  for (const [k, placed] of entries) map.set(k, [...(map.get(k) ?? []), placed])
  return map
}

/** Checks one class source. Pairs and centring are judged across its fragments; hits stay per token. */
function checkSource(fragments: readonly ClassFragment[], version: SemVer, bothNames: boolean): LintHit[] {
  const tokens = fragments.flatMap((f, fragment) =>
    [...f.text.matchAll(/\S+/g)].map((m) => ({ token: m[0], at: f.offset + m.index, parsed: parseClass(m[0]), placed: { fragment, conditional: f.conditional }, sided: f.sided === true })))
  const keys = index(tokens.map(({ parsed: p, placed }) => [key(p.variants, p.negative, p.core), placed]))
  const cores = index(tokens.map(({ parsed: p, placed }) => [p.core, placed]))
  const overridden = new Set(tokens.filter(({ parsed: p }) => p.variants.some((v) => DIRECTION_VARIANT.test(v))).map(({ parsed: p }) => familyOf(p.core)))
  const hits: LintHit[] = []
  for (const { token, at, parsed, placed, sided } of tokens) {
    const matches = TAILWIND_MAP.filter((e) => e.pattern.test(parsed.core))
    if (matches.length === 0 || sided || sideScoped(parsed.variants) || isOffscreen(parsed.negative, parsed.core)) continue
    if (overridden.has(familyOf(parsed.core))) continue
    const near = (map: Map<string, Placed[]>, k: string): boolean => (map.get(k) ?? []).some((p) => together(placed, p))
    const paired = near(keys, key(parsed.variants, parsed.negative, mirror(parsed.core)))
    if (paired || isCentring(parsed.core, (t) => near(cores, t))) continue
    hits.push({ offset: at, message: messageFor(token, parsed, matches, version, bothNames) })
  }
  return hits
}

const physicalTailwind: LintRule = {
  id: 'source/physical-tailwind',
  severity: 'warning',
  title: 'Use logical Tailwind classes instead of left and right',
  why: 'A physical class such as ml-4, pr-2, left-0, text-left or rounded-l-lg stays on the same side in Arabic, so the margin, padding, offset, alignment or corner is on the wrong edge.',
  fix: 'Use the logical class, such as ms-4, pe-2, start-0 (inset-s-0 from Tailwind 4.2), text-start or rounded-s-lg, so the side follows the reading direction. Keep a physical class only under an rtl:, ltr: or side variant such as data-[side=left]:, or beside an rtl: or ltr: override of the same family.',
  langs: ['css', 'scss', 'html', 'js', 'jsx', 'ts', 'tsx'],
  check: (file, ctx) => {
    const version = coerce(ctx.tailwindVersion(file))
    if (!version || lt(version, FLOOR)) return []
    const bothNames = spansRename(ctx.tailwindRange?.(file))
    const sources = new Map<number, ClassFragment[]>()
    for (const f of classStrings(file)) sources.set(f.group, [...(sources.get(f.group) ?? []), f])
    return [...sources.values()].flatMap((fragments) => checkSource(fragments, version, bothNames)).sort((a, b) => a.offset - b.offset)
  },
}

export const TAILWIND_RULES: readonly LintRule[] = [physicalTailwind]
