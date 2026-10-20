import { coerce, compare, lt, type SemVer } from 'semver'
import { classStrings } from '../classes'
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

/** rtl or ltr as a whole word anywhere in a variant: rtl:, ltr:, group-[dir=rtl]:, [dir=rtl]_&:, [&:dir(rtl)]:. */
const DIRECTION_VARIANT = /(^|[^a-z0-9])(rtl|ltr)(?![a-z0-9])/i
const directionScoped = (variants: readonly string[]): boolean => variants.some((v) => DIRECTION_VARIANT.test(v))

/** The side word in a physical class, so it can be mirrored. */
const SIDE = /^((?:scroll-)?[mp]|rounded-[tb]?|border-|text-|float-|clear-|)(left|right|l|r)(?=-|$)/
const SWAP: Readonly<Record<string, string>> = { left: 'right', right: 'left', l: 'r', r: 'l' }
const sideOf = (core: string): string | null => SIDE.exec(core)?.[2] ?? null
const mirror = (core: string): string => core.replace(SIDE, (_, head: string, side: string) => `${head}${SWAP[side]}`)

const key = (variants: readonly string[], negative: string, core: string): string => `${variants.join(':')}|${negative}|${core}`

/** left-1/2 with a 50% x translate centres the box in either direction. */
const HALF = new Set(['1/2', '[50%]'])
const isCentring = (core: string, cores: ReadonlySet<string>): boolean => {
  const match = /^(?:left|right)-(.+)$/.exec(core)
  return match !== null && HALF.has(match[1]!) && [...HALF].some((v) => cores.has(`translate-x-${v}`))
}

function messageFor(token: string, parsed: ParsedClass, matches: readonly TailwindEntry[], version: SemVer): string {
  const side = sideOf(parsed.core)?.startsWith('l') ? 'left' : 'right'
  const usable = matches.filter((e) => !lt(version, e.since)).sort((a, b) => compare(b.since, a.since))
  const entry = usable[0]
  const replaced = entry?.replace(parsed.core)
  if (!entry || !replaced) {
    const first = matches.map((e) => e.since).sort(compare)[0]
    return `\`${token}\` stays on the ${side} in Arabic. Tailwind ${first} adds a logical class for it; until then use the logical CSS property.`
  }
  const prefix = parsed.variants.map((v) => `${v}:`).join('')
  const fixed = `${prefix}${parsed.important[0]}${parsed.negative}${replaced}${parsed.important[1]}`
  return `\`${token}\` stays on the ${side} in Arabic. Use \`${fixed}\`.`
}

function checkFragment(text: string, offset: number, version: SemVer): LintHit[] {
  const tokens = [...text.matchAll(/\S+/g)].map((m) => ({ token: m[0], at: offset + m.index, parsed: parseClass(m[0]) }))
  const keys = new Set(tokens.map(({ parsed: p }) => key(p.variants, p.negative, p.core)))
  const cores = new Set(tokens.map(({ parsed: p }) => p.core))
  const hits: LintHit[] = []
  for (const { token, at, parsed } of tokens) {
    const matches = TAILWIND_MAP.filter((e) => e.pattern.test(parsed.core))
    if (matches.length === 0 || directionScoped(parsed.variants)) continue
    if (keys.has(key(parsed.variants, parsed.negative, mirror(parsed.core))) || isCentring(parsed.core, cores)) continue
    hits.push({ offset: at, message: messageFor(token, parsed, matches, version) })
  }
  return hits
}

const physicalTailwind: LintRule = {
  id: 'source/physical-tailwind',
  severity: 'warning',
  title: 'Use logical Tailwind classes instead of left and right',
  why: 'A physical class such as ml-4, pr-2, left-0, text-left or rounded-l-lg stays on the same side in Arabic, so the margin, padding, offset, alignment or corner is on the wrong edge.',
  fix: 'Use the logical class, such as ms-4, pe-2, start-0 (inset-s-0 from Tailwind 4.2), text-start or rounded-s-lg, so the side follows the reading direction. Keep a physical class only under an rtl: or ltr: variant.',
  langs: ['css', 'scss', 'html', 'js', 'jsx', 'ts', 'tsx'],
  check: (file, ctx) => {
    const version = coerce(ctx.tailwindVersion(file))
    if (!version || lt(version, FLOOR)) return []
    return classStrings(file).flatMap((f) => checkFragment(f.text, f.offset, version))
  },
}

export const TAILWIND_RULES: readonly LintRule[] = [physicalTailwind]
