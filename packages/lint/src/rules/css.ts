import type { Container, Declaration, Rule } from 'postcss'
import { directionScoped, fullSelectors, targetsArabic, withoutDirection } from '../selectors'
import type { LintHit, LintRule, SourceFile } from '../types'

const CSS_LANGS = ['css', 'scss', 'html'] as const

/** Calls visit for every declaration with its offset in the file text and its enclosing rule, if any. */
function eachDeclaration(file: SourceFile, visit: (decl: Declaration, offset: number, rule: Rule | null) => void): void {
  for (const block of file.css) {
    block.root.walkDecls((decl) => {
      const start = decl.source?.start?.offset
      if (start === undefined) return
      let parent = decl.parent as Container | undefined
      while (parent && parent.type !== 'rule') parent = parent.parent as Container | undefined
      visit(decl, block.offset + start, (parent as Rule | undefined) ?? null)
    })
  }
}

const ZERO_WITH_UNIT = /(^|[\s(,])[+-]?0*\.?0+[a-z%]*(?=$|[\s),])/g

/** Lower case, one space between tokens, no !important, and every zero with any unit written as 0. */
const normalise = (value: string): string =>
  value.replace(/!\s*important/i, '').trim().replace(/\s+/g, ' ').toLowerCase().replace(ZERO_WITH_UNIT, '$10')

const PHYSICAL_PROPS: Readonly<Record<string, string>> = {
  'margin-left': 'margin-inline-start', 'margin-right': 'margin-inline-end',
  'padding-left': 'padding-inline-start', 'padding-right': 'padding-inline-end',
  'border-left': 'border-inline-start', 'border-right': 'border-inline-end',
  'border-left-width': 'border-inline-start-width', 'border-right-width': 'border-inline-end-width',
  'border-left-style': 'border-inline-start-style', 'border-right-style': 'border-inline-end-style',
  'border-left-color': 'border-inline-start-color', 'border-right-color': 'border-inline-end-color',
  left: 'inset-inline-start', right: 'inset-inline-end',
  'border-top-left-radius': 'border-start-start-radius', 'border-top-right-radius': 'border-start-end-radius',
  'border-bottom-left-radius': 'border-end-start-radius', 'border-bottom-right-radius': 'border-end-end-radius',
}

/** The other side of a physical pair; two sides set to the same value are symmetric and need no mirroring. */
const OPPOSITE: Readonly<Record<string, string>> = Object.fromEntries(
  Object.keys(PHYSICAL_PROPS).flatMap((prop) => {
    const flipped = prop.includes('left') ? prop.replace('left', 'right') : prop.replace('right', 'left')
    return flipped === prop ? [] : [[prop, flipped]]
  }),
)

const KEYWORD_PROPS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  float: { left: 'inline-start', right: 'inline-end' },
  clear: { left: 'inline-start', right: 'inline-end' },
  'text-align': { left: 'start', right: 'end' },
}

/** left: -9999px is the visually-hidden idiom. It moves the box far offscreen on either side, so it needs no mirror. */
const OFFSCREEN = /^-\s*(\d+(?:\.\d+)?)[a-z%]*$/
const OFFSCREEN_MIN = 999
const isOffscreen = (prop: string, value: string): boolean => {
  if (prop !== 'left' && prop !== 'right') return false
  const match = OFFSCREEN.exec(value)
  return match !== null && Number(match[1]) >= OFFSCREEN_MIN
}

const CENTRING_TRANSFORM = /translate(?:x|3d)?\(\s*[+-]?50%/
const CENTRING_TRANSLATE = /^[+-]?50%/

/** left: 50% with a 50% x translate in the same block centres a box in either direction. */
function isCentring(decl: Declaration, prop: string, value: string): boolean {
  if ((prop !== 'left' && prop !== 'right') || value !== '50%') return false
  return (decl.parent?.nodes ?? []).some((n) => {
    if (n.type !== 'decl') return false
    const p = n.prop.toLowerCase()
    const v = normalise(n.value)
    return (p === 'transform' && CENTRING_TRANSFORM.test(v)) || (p === 'translate' && CENTRING_TRANSLATE.test(v))
  })
}

function hasSymmetricSibling(decl: Declaration, prop: string, value: string): boolean {
  const opposite = OPPOSITE[prop]
  const parent = decl.parent
  if (!opposite || !parent) return false
  return (parent.nodes ?? []).some((n) => n.type === 'decl' && n.prop.toLowerCase() === opposite && normalise(n.value) === value)
}

/** Shorthands that also set a physical property, so an override written with them resets it. */
function coveringProps(prop: string): string[] {
  const out = [prop]
  const side = /^(margin|padding|border)-(left|right)(?:-(width|style|color))?$/.exec(prop)
  if (side) {
    const [, box, , part] = side
    out.push(box!, `${box}-inline`)
    if (part) out.push(`${box}-${side[2]}`, `border-${part}`, `border-inline-${part}`)
  } else if (prop === 'left' || prop === 'right') out.push('inset', 'inset-inline')
  else if (/^border-(?:top|bottom)-(?:left|right)-radius$/.test(prop)) out.push('border-radius')
  return out
}

/** selector|property for every declaration in a direction-scoped rule in the file, with the direction parts removed from the selector. */
function directionOverrides(file: SourceFile): Set<string> {
  const out = new Set<string>()
  for (const block of file.css) {
    block.root.walkRules((rule) => {
      const props = (rule.nodes ?? []).flatMap((n) => (n.type === 'decl' ? [n.prop.toLowerCase()] : []))
      for (const selector of fullSelectors(rule)) {
        if (!directionScoped(selector)) continue
        const base = withoutDirection(selector)
        for (const prop of props) out.add(`${base}|${prop}`)
      }
    })
  }
  return out
}

/** Every selector of the rule has a direction-scoped twin in the file that resets the same property, directly or by a shorthand. */
function overridden(rule: Rule | null, prop: string, overrides: ReadonlySet<string>): boolean {
  if (!rule || overrides.size === 0) return false
  const covering = coveringProps(prop)
  return fullSelectors(rule).every((s) => covering.some((p) => overrides.has(`${withoutDirection(s)}|${p}`)))
}

function physicalFix(prop: string, value: string): string | null {
  const logical = PHYSICAL_PROPS[prop]
  if (logical) return logical
  const word = KEYWORD_PROPS[prop]?.[value]
  return word ? `${prop}: ${word}` : null
}

const physicalCss: LintRule = {
  id: 'source/physical-css',
  severity: 'warning',
  title: 'Use logical CSS properties instead of left and right',
  why: 'A physical left or right property stays on the same side in Arabic, so the margin, padding, border, offset or alignment is on the wrong edge and the layout looks unbalanced.',
  fix: 'Use the logical property, such as margin-inline-start, padding-inline-end, inset-inline-start or text-align: start, so the side follows the reading direction.',
  langs: CSS_LANGS,
  check: (file) => {
    const hits: LintHit[] = []
    const overrides = directionOverrides(file)
    eachDeclaration(file, (decl, offset, rule) => {
      const prop = decl.prop.toLowerCase()
      if (prop.startsWith('-') || prop.includes('#{') || prop.includes('$') || prop.includes('@')) return
      const value = normalise(decl.value)
      const logical = physicalFix(prop, value)
      if (!logical) return
      if (PHYSICAL_PROPS[prop] ? hasSymmetricSibling(decl, prop, value) || isOffscreen(prop, value) || isCentring(decl, prop, value) : false) return
      if (rule && fullSelectors(rule).every(directionScoped)) return
      if (overridden(rule, prop, overrides)) return
      hits.push({ offset, message: `\`${prop}: ${normalise(decl.value)}\` is tied to one side. Use \`${logical}\`.` })
    })
    return hits
  },
}

const NEUTRAL_SPACING = /^(?:[+-]?(?:0+\.?0*|\.0+)[a-z%]*|normal|initial|inherit|unset|revert|revert-layer)$/
const UNKNOWN_VALUE = /var\(|\$|#\{|@|env\(|calc\(/

const CODE_SUBJECT = /^(?:code|pre|kbd|samp)(?![\w-])/i

/** The last compound of a selector, outside brackets and parentheses. */
function subject(selector: string): string {
  let depth = 0
  let from = 0
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i]!
    if (ch === '(' || ch === '[') depth++
    else if ((ch === ')' || ch === ']') && depth > 0) depth--
    else if (depth === 0 && /[\s>+~]/.test(ch)) from = i + 1
  }
  return selector.slice(from)
}

/** Latin code set in an Arabic page: code, pre, kbd or samp as the selector's subject. */
const codeSubject = (selector: string): boolean => CODE_SUBJECT.test(subject(selector.trim()))

const arabicLetterSpacing: LintRule = {
  id: 'source/arabic-letter-spacing',
  severity: 'error',
  title: 'No letter-spacing on Arabic text',
  why: 'Letter-spacing pulls the joined Arabic letters apart, so words break into separate glyphs and become hard to read.',
  fix: 'Set letter-spacing: 0 (or remove it) for Arabic selectors, and keep tracking on Latin text only.',
  langs: CSS_LANGS,
  check: (file) => {
    const hits: LintHit[] = []
    eachDeclaration(file, (decl, offset, rule) => {
      if (decl.prop.toLowerCase() !== 'letter-spacing' || !rule) return
      const value = normalise(decl.value)
      if (NEUTRAL_SPACING.test(value) || UNKNOWN_VALUE.test(value)) return
      const arabic = fullSelectors(rule).find((s) => targetsArabic(s) && !codeSubject(s))
      if (arabic === undefined) return
      hits.push({ offset, message: `\`letter-spacing: ${value}\` on \`${arabic.trim()}\` breaks the joins between Arabic letters.` })
    })
    return hits
  },
}

const DIR_ATTRIBUTE = /\[\s*dir\s*[~|^$*]?=/i

const dirAttributeSelector: LintRule = {
  id: 'source/dir-attribute-selector',
  severity: 'note',
  title: 'Prefer :dir() to a [dir] attribute selector',
  why: 'A [dir] attribute selector misses content whose direction is inherited from a parent or set by dir=auto, so that content keeps the wrong styles.',
  fix: 'Use the :dir(rtl) or :dir(ltr) pseudo-class, which matches the direction that applies to the element.',
  langs: CSS_LANGS,
  check: (file) => {
    const hits: LintHit[] = []
    for (const block of file.css) {
      block.root.walkRules((rule) => {
        const start = rule.source?.start?.offset
        if (start === undefined || !rule.selectors.some((s) => DIR_ATTRIBUTE.test(s))) return
        hits.push({ offset: block.offset + start, message: `\`${rule.selector.trim().replace(/\s+/g, ' ')}\` matches the dir attribute only. Use \`:dir()\`.` })
      })
    }
    return hits
  },
}

export const CSS_RULES: readonly LintRule[] = [physicalCss, arabicLetterSpacing, dirAttributeSelector]
