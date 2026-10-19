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

const shell = (css: string, body: string) =>
  `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`

const cssOf = (e: Example) => [e.cssFromQuote ? e.quote : '', e.css ?? ''].filter(Boolean).join('\n')

// Fonts are type-pairing's job, and all four skills load together, so only its page is held to the font rule.
const OWNED_BY: Record<string, string> = { 'type/arabic-font': 'dualkit-type-pairing' }
const ignoredFor = (skill: string): string[] => Object.entries(OWNED_BY).filter(([, owner]) => owner !== skill).map(([rule]) => rule)

const skillsWithExamples = [...new Set(EXAMPLES.map((e) => e.skill))]

afterAll(closeBrowser)

describe('skill examples through the rules', () => {
  it('runs all 20 rules', () => expect(RULES).toHaveLength(20))

  it('renders the bare shell with findings', async () => {
    const ids = runRules(await modelOf(shell('', '<p>مرحبا بكم</p>'))).map((f) => f.rule)
    expect(ids).toContain('type/arabic-font')
  })

  it('each fixture quote appears verbatim in its skill', () => {
    for (const e of EXAMPLES) expect(read(e.skill), e.quote).toContain(e.quote)
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

  it.each(skillsWithExamples)('%s: its good examples pass all 20 rules on their own page', async (skill) => {
    const own = EXAMPLES.filter((e) => e.skill === skill)
    const page = shell(own.map(cssOf).join('\n'), own.map((e) => e.html).join('\n'))
    const findings = runRules(await modelOf(page), { ignore: ignoredFor(skill) }).map((f) => `${skill} ${f.rule}: ${f.message}`)
    expect(findings).toEqual([])
  })
})
