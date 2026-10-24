import type { LiveDeclaration } from '@dualkit/lint'

/** Splits a CSS value at spaces outside parentheses and quotes. */
export function splitSpaces(value: string): string[] {
  const out: string[] = []
  let depth = 0
  let quote = ''
  let from = -1
  for (let i = 0; i <= value.length; i++) {
    const ch = value[i] ?? ' '
    if (quote) {
      if (ch === quote) quote = ''
      continue
    }
    if (ch === '"' || ch === "'") quote = ch
    else if (ch === '(') depth++
    else if (ch === ')' && depth > 0) depth--
    const space = depth === 0 && /\s/.test(ch)
    if (!space && from === -1) from = i
    if (space && from !== -1) {
      out.push(value.slice(from, i))
      from = -1
    }
  }
  return out
}

/** Splits a CSS value at commas outside parentheses. */
function splitCommas(value: string): string[] {
  const out: string[] = []
  let depth = 0
  let from = 0
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]
    if (ch === '(') depth++
    else if (ch === ')' && depth > 0) depth--
    else if (ch === ',' && depth === 0) {
      out.push(value.slice(from, i))
      from = i + 1
    }
  }
  return [...out, value.slice(from)]
}

/** A 4-value margin or padding whose right and left differ, as the block pair and the inline pair. */
export type SplitShorthand = { property: string; block: string; inline: string }

const BOX = new Set(['margin', 'padding'])

/** `margin: t r b l` becomes `margin-block: t b` and `margin-inline: l r`; null when the value is not four tokens or the sides match. */
export function splitShorthand(prop: string, value: string, normalised: string): SplitShorthand | null {
  if (!BOX.has(prop) || /[$@]|#\{/.test(value)) return null
  const raw = splitSpaces(value)
  const norm = splitSpaces(normalised)
  if (raw.length !== 4 || norm.length !== 4 || norm[1] === norm[3]) return null
  return { property: prop, block: `${raw[0]} ${raw[2]}`, inline: `${raw[3]} ${raw[1]}` }
}

const ZERO = /^[+-]?0*\.?0+[a-z%]*$/
const LENGTH = /^[+-]?(?:\d|\.\d)/
const CENTRE = /^[+-]?50%$/
const CENTRE_SIBLINGS = new Set(['left', 'right', 'inset-inline-start', 'inset-inline-end'])

const hasCentreOffset = (live: LiveDeclaration): boolean =>
  (live.decl.parent?.nodes ?? []).some((n) => n.type === 'decl' && CENTRE_SIBLINGS.has(n.prop.toLowerCase()) && n.value.trim() === '50%')

function translateMoves(live: LiveDeclaration): boolean {
  for (const m of live.value.matchAll(/translate(?:x|3d)?\(\s*([^,)]*)/g)) {
    const x = m[1]!.trim()
    if (ZERO.test(x)) continue
    if (CENTRE.test(x) && hasCentreOffset(live)) continue
    return true
  }
  return false
}

function shadowMoves(value: string): boolean {
  return splitCommas(value).some((shadow) => {
    const x = splitSpaces(shadow).filter((t) => t !== 'inset')[0]
    return x !== undefined && LENGTH.test(x) && !ZERO.test(x)
  })
}

const SIDE_WORD = /(?:^|\s)(?:left|right)(?=$|\s)/

/** The four corners of a border-radius value (top left, top right, bottom right, bottom left), or null when it cannot be read. */
function corners(value: string): string[] | null {
  if (value.includes('/')) return null
  const t = splitSpaces(value)
  const [a, b, c, d] = t
  if (t.length === 1) return [a!, a!, a!, a!]
  if (t.length === 2) return [a!, b!, a!, b!]
  if (t.length === 3) return [a!, b!, c!, b!]
  return t.length === 4 ? [a!, b!, c!, d!] : null
}

function sidesDiffer(prop: string, value: string): boolean {
  if (prop === 'border-width') {
    const t = splitSpaces(value)
    return t.length === 4 && t[1] !== t[3]
  }
  const c = corners(value)
  return c !== null && (c[0] !== c[1] || c[3] !== c[2])
}

const MOVES: Readonly<Record<string, string>> = {
  transform: 'A horizontal translate moves the same way in Arabic. Use a logical offset, or flip the sign for Arabic with `:dir(rtl)`.',
  'background-position': 'A background placed left or right stays there in Arabic. Use `:dir(rtl)` with the opposite side.',
  'box-shadow': 'A shadow with a horizontal offset falls on the same side in Arabic. Use `:dir(rtl)` with the offset negated.',
  'border-width': 'A border width cannot be set per logical side in one shorthand. Use border-inline-start-width and border-inline-end-width.',
  'border-radius': 'Corner radii cannot be set per logical side in one shorthand. Use border-start-start-radius and its three siblings.',
}

/** The advice for a declaration that has no logical form but would look wrong in Arabic, or null when it is fine. */
export function noLogicalForm(live: LiveDeclaration): string | null {
  const { prop, value } = live
  const hit =
    prop === 'transform' ? translateMoves(live)
    : prop === 'background-position' || prop === 'background-position-x' ? SIDE_WORD.test(value)
    : prop === 'box-shadow' ? shadowMoves(value)
    : prop === 'border-width' || prop === 'border-radius' ? sidesDiffer(prop, value)
    : false
  return hit ? (MOVES[prop === 'background-position-x' ? 'background-position' : prop] ?? null) : null
}
