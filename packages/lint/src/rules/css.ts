import type { Container, Declaration, Rule } from 'postcss'
import { directionScoped, fullSelectors, targetsArabic } from '../selectors'
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

const normalise = (value: string): string => value.replace(/!\s*important/i, '').trim().replace(/\s+/g, ' ').toLowerCase()

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

function hasSymmetricSibling(decl: Declaration, prop: string, value: string): boolean {
  const opposite = OPPOSITE[prop]
  const parent = decl.parent
  if (!opposite || !parent) return false
  return (parent.nodes ?? []).some((n) => n.type === 'decl' && n.prop.toLowerCase() === opposite && normalise(n.value) === value)
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
    eachDeclaration(file, (decl, offset, rule) => {
      const prop = decl.prop.toLowerCase()
      if (prop.startsWith('-') || prop.includes('#{') || prop.includes('$') || prop.includes('@')) return
      const value = normalise(decl.value)
      const logical = physicalFix(prop, value)
      if (!logical) return
      if (PHYSICAL_PROPS[prop] ? hasSymmetricSibling(decl, prop, value) || isOffscreen(prop, value) : false) return
      if (rule && fullSelectors(rule).every(directionScoped)) return
      hits.push({ offset, message: `\`${prop}: ${normalise(decl.value)}\` is tied to one side. Use \`${logical}\`.` })
    })
    return hits
  },
}

const NEUTRAL_SPACING = /^(?:[+-]?(?:0+\.?0*|\.0+)[a-z%]*|normal|initial|inherit|unset|revert|revert-layer)$/
const UNKNOWN_VALUE = /var\(|\$|#\{|@|env\(|calc\(/

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
      const arabic = fullSelectors(rule).find(targetsArabic)
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
