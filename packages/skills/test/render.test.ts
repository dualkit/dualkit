import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { closeBrowser, modelOf } from '../../rules/test/helpers/browser'
import { runRules } from '../../rules/src/index'
import { EXAMPLES, UNRENDERED } from './examples'
import { fencesOf } from './fences'

const SKILLS = join(import.meta.dirname, '../../../plugin/skills')
const names = readdirSync(SKILLS).filter((n) => existsSync(join(SKILLS, n, 'SKILL.md')))
const read = (name: string) => readFileSync(join(SKILLS, name, 'SKILL.md'), 'utf8')
const RENDERABLE = new Set(['css', 'html', 'tsx', 'ts'])

const shell = (css: string, body: string) =>
  `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`

afterAll(closeBrowser)

describe('skill examples through the rules', () => {
  it('renders the bare shell with findings', async () => {
    const ids = runRules(await modelOf(shell('', '<p>مرحبا بكم</p>'))).map((f) => f.rule)
    expect(ids).toContain('type/arabic-font')
  })

  it('each fixture quote appears verbatim in its skill', () => {
    for (const e of EXAMPLES) expect(read(e.skill), e.quote).toContain(e.quote)
  })

  it('every renderable block is covered', () => {
    const uncovered = names.flatMap((name) =>
      fencesOf(name, read(name))
        .filter((f) => RENDERABLE.has(f.lang))
        .filter((f) => !EXAMPLES.some((e) => e.skill === name && f.code.includes(e.quote)))
        .filter((f) => !UNRENDERED.some((u) => u.skill === name && u.index === f.index))
        .map((f) => `${name} block ${f.index} (${f.lang}, under "${f.section}")`))
    expect(uncovered).toEqual([])
  })

  it('lists only unrendered blocks that exist', () => {
    for (const u of UNRENDERED) expect(fencesOf(u.skill, read(u.skill)).some((f) => f.index === u.index), `${u.skill} ${u.index}`).toBe(true)
  })

  it('the good examples pass all 20 rules', async () => {
    const page = shell(EXAMPLES.map((e) => e.css ?? '').join('\n'), EXAMPLES.map((e) => e.html).join('\n'))
    expect(runRules(await modelOf(page)).map((f) => `${f.rule}: ${f.message}`)).toEqual([])
  })
})
