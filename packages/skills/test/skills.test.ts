import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as format from '../../format/src/index'
import { parseSkill, renderCursorRule } from '../scripts/skill-file.mjs'

const ROOT = join(import.meta.dirname, '../../..')
const SKILLS = join(ROOT, 'skills')
const RULES = join(ROOT, 'cursor/rules')
const names = readdirSync(SKILLS).filter((n) => existsSync(join(SKILLS, n, 'SKILL.md')))
const read = (name: string) => readFileSync(join(SKILLS, name, 'SKILL.md'), 'utf8')
const words = (text: string) => text.split(/\s+/).filter(Boolean).length

describe('parseSkill', () => {
  it('splits frontmatter from the body', () => {
    const skill = parseSkill('---\nname: a-b\ndescription: Use when testing\n---\n\n# Body\n')
    expect(skill).toEqual({ name: 'a-b', description: 'Use when testing', body: '# Body\n' })
  })

  it('refuses a file with no frontmatter', () => {
    expect(() => parseSkill('# Body')).toThrow(/frontmatter/)
  })
})

describe('renderCursorRule', () => {
  it('writes an agent-requested Cursor rule from a skill', () => {
    const rule = renderCursorRule({ name: 'a-b', description: 'Use when testing', body: '# Body\n' })
    expect(rule).toBe('---\ndescription: Use when testing\nglobs:\nalwaysApply: false\n---\n\n# Body\n')
  })
})

describe('the skills', () => {
  it('ships four skills', () => {
    expect(names.sort()).toEqual([
      'dualkit-bilingual-copy',
      'dualkit-gulf-formats',
      'dualkit-rtl-layout',
      'dualkit-type-pairing',
    ])
  })

  it.each(names)('%s has a valid name and a "Use when" description', (name) => {
    const skill = parseSkill(read(name))
    expect(skill.name).toBe(name)
    expect(skill.name).toMatch(/^[a-z0-9-]+$/)
    expect(skill.description).toMatch(/^Use when /)
    expect(skill.name.length + skill.description.length).toBeLessThan(1024)
  })

  it.each(names)('%s stays under 900 words', (name) => {
    expect(words(parseSkill(read(name)).body)).toBeLessThan(900)
  })

  it.each(names)('%s only imports functions @dualkit/format really exports', (name) => {
    const imports = [...read(name).matchAll(/import\s*\{([^}]+)\}\s*from\s*'@dualkit\/format'/g)]
    const used = imports.flatMap((m) => (m[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean))
    for (const fn of used) expect(format, `${fn} is not exported`).toHaveProperty(fn)
  })
})

describe('the Cursor rules', () => {
  it.each(names)('%s has an up-to-date Cursor rule (run npm run build)', (name) => {
    const rule = readFileSync(join(RULES, `${name}.mdc`), 'utf8')
    expect(rule).toBe(renderCursorRule(parseSkill(read(name))))
  })

  it('has no rule without a skill', () => {
    const rules = readdirSync(RULES).map((f) => f.replace(/\.mdc$/, ''))
    expect(rules.sort()).toEqual([...names].sort())
  })
})

describe('the Claude Code plugin', () => {
  it('lists the plugin in the marketplace', () => {
    const market = JSON.parse(readFileSync(join(ROOT, '.claude-plugin/marketplace.json'), 'utf8'))
    const plugin = JSON.parse(readFileSync(join(ROOT, '.claude-plugin/plugin.json'), 'utf8'))
    expect(market.plugins).toEqual([expect.objectContaining({ name: plugin.name, source: './' })])
  })
})
