import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { RULES, runRules } from '../../rules/src/index'
import { closeBrowser, modelOf } from '../../rules/test/helpers/browser'
import { EXAMPLES, UNRENDERED, type Example } from './examples'
import { fencesOf } from './fences'

const SKILLS = join(import.meta.dirname, '../../../plugin/skills')
const names = readdirSync(SKILLS).filter((n) => existsSync(join(SKILLS, n, 'SKILL.md')))
const read = (name: string) => readFileSync(join(SKILLS, name, 'SKILL.md'), 'utf8')
/** Fence languages that are never UI code. Any other language, or none, must be covered or listed in UNRENDERED. */
const NON_RENDER = new Set(['bash', 'sh', 'json', 'md', 'text'])

const FONT_DIR = join(import.meta.dirname, '../../rules/test/fonts')
const fontData = (file: string) => `data:font/woff2;base64,${readFileSync(join(FONT_DIR, file)).toString('base64')}`
/** A site serves its own font files. The harness has no server, so IBM Plex Sans Arabic urls point at the fixture files. */
const withServedFonts = (css: string) =>
  css.replace(/url\((['"]?)\/fonts\/ibm-plex-sans-arabic-(\d+)\.woff2\1\)/g, (_m, _q, weight: string) =>
    `url(${fontData(Number(weight) < 600 ? 'IBMPlexSansArabic-Regular.woff2' : 'IBMPlexSansArabic-Bold.woff2')})`)

const shell = (css: string, body: string) =>
  `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${withServedFonts(css)}</style></head><body>${body}</body></html>`

const cssOf = (e: Example) => [e.cssFromQuote ? e.quote : '', e.css ?? ''].filter(Boolean).join('\n')

// Fonts are type-pairing's job, and all four skills load together, so only its page is held to the font rule.
const OWNED_BY: Record<string, string> = { 'type/arabic-font': 'dualkit-type-pairing' }
const ignoredFor = (skill: string): string[] => Object.entries(OWNED_BY).filter(([, owner]) => owner !== skill).map(([rule]) => rule)

const skillsWithExamples = [...new Set(EXAMPLES.map((e) => e.skill))]

const linesOf = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean)
/** The language of the fenced block holding the quote, or 'prose' when the quote is running text. */
const sourceOf = (e: Example) => fencesOf(e.skill, read(e.skill)).find((f) => f.code.includes(e.quote))?.lang ?? 'prose'
const HAND_WRITTEN = new Set(['tsx', 'ts', 'prose'])

/** Each hand-written `html` checked against the advice its quote gives, so the two cannot drift apart. */
const PINS: Record<string, (e: Example) => void> = {
  "<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>": (e) => {
    expect(e.quote).toContain("locale === 'ar' ? 'rtl'")
    expect(shell('', '')).toContain('<html lang="ar" dir="rtl">')
    expect(e.html).not.toMatch(/\b(?:lang|dir)=/)
  },
  '<p>{t.phoneHint} <bdi dir="ltr">050 123 4567</bdi></p>': (e) => {
    const isolate = '<bdi dir="ltr">050 123 4567</bdi>'
    expect(e.quote).toContain(isolate)
    expect(e.html).toContain(isolate)
  },
  'A formatted Arabic amount (`1,234.50 د.إ`) or Arabic date contains Arabic, so give it a plain `<bdi>` with no `dir`.': (e) => {
    expect(e.quote).toContain('plain `<bdi>` with no `dir`')
    expect(e.html).toContain('<bdi>1,234.50 د.إ</bdi>')
    expect(e.html).not.toMatch(/<bdi[^>]*\bdir=/)
  },
}
PINS[EXAMPLES.find((e) => e.quote.startsWith('const count = '))!.quote] = (e) => {
  const count = Number(/const count = (\d+)/.exec(e.quote)?.[1])
  const form = new Intl.PluralRules('ar').select(count)
  const sentence = new RegExp(`${form}: '([^']+)'`).exec(e.quote)?.[1]
  expect(sentence, `${form} form in the quote`).toBeDefined()
  expect(e.html).toContain(sentence!.replace('{count}', String(count)))
}

afterAll(closeBrowser)

describe('skill examples through the rules', () => {
  it('runs all 32 rules', () => expect(RULES).toHaveLength(32))

  it('renders the bare shell with findings', async () => {
    const ids = runRules(await modelOf(shell('', '<p>مرحبا بكم</p>'))).map((f) => f.rule)
    expect(ids).toContain('type/arabic-font')
  })

  it('each fixture quote appears verbatim in its skill', () => {
    for (const e of EXAMPLES) expect(read(e.skill), e.quote).toContain(e.quote)
  })

  it('an html block renders every quoted line verbatim', () => {
    const missing = EXAMPLES.filter((e) => sourceOf(e) === 'html')
      .flatMap((e) => linesOf(e.quote).filter((line) => !e.html.includes(line)).map((line) => `${e.skill}: ${line}`))
    expect(missing).toEqual([])
  })

  it('a css block renders as its own quote', () => {
    for (const e of EXAMPLES.filter((x) => sourceOf(x) === 'css')) expect(e.cssFromQuote, e.quote).toBe(true)
  })

  it('only tsx, ts and prose sources have hand-written html, and each is pinned', () => {
    const unpinned = EXAMPLES.filter((e) => !['html', 'css'].includes(sourceOf(e)))
      .filter((e) => !HAND_WRITTEN.has(sourceOf(e)) || !PINS[e.quote])
      .map((e) => `${e.skill} (${sourceOf(e)}): ${e.quote}`)
    expect(unpinned).toEqual([])
    expect(Object.keys(PINS)).toHaveLength(EXAMPLES.filter((e) => HAND_WRITTEN.has(sourceOf(e))).length)
  })

  it.each(Object.keys(PINS).map((q) => [q.split('\n')[0], q]))('hand-written html follows its skill: %s', (_first, quote) => {
    const e = EXAMPLES.find((x) => x.quote === quote)
    expect(e, quote).toBeDefined()
    PINS[quote]!(e!)
  })

  it('every renderable block is covered, line by line', () => {
    const uncovered = names.flatMap((name) => {
      const quotes = EXAMPLES.filter((e) => e.skill === name).map((e) => e.quote)
      return fencesOf(name, read(name))
        .filter((f) => !NON_RENDER.has(f.lang))
        .filter((f) => !UNRENDERED.some((u) => u.skill === name && u.index === f.index))
        .flatMap((f) =>
          f.code.split('\n').map((l) => l.trim()).filter(Boolean)
            .filter((line) => !quotes.some((q) => q.includes(line)))
            .map((line) => `${name} block ${f.index} (${f.lang || 'untagged'}, under "${f.section}"): ${line}`))
    })
    expect(uncovered).toEqual([])
  })

  it('lists only unrendered blocks that exist and contain their quote', () => {
    for (const u of UNRENDERED) {
      const fence = fencesOf(u.skill, read(u.skill)).find((f) => f.index === u.index)
      expect(fence, `${u.skill} block ${u.index} exists`).toBeDefined()
      expect(fence?.code, `${u.skill} block ${u.index} quote`).toContain(u.quote)
    }
  })

  it.each(skillsWithExamples)('%s: its good examples pass all 32 rules on their own page', async (skill) => {
    const own = EXAMPLES.filter((e) => e.skill === skill)
    const page = shell(own.map(cssOf).join('\n'), own.map((e) => e.html).join('\n'))
    const findings = runRules(await modelOf(page), { ignore: ignoredFor(skill) }).map((f) => `${skill} ${f.rule}: ${f.message}`)
    expect(findings).toEqual([])
  })
})
