import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BenchError, ROOT } from './config'
import type { Condition } from './store'

export const BASE_SYSTEM = 'You are a front-end developer. Build exactly what the user asks for. Reply with one complete, self-contained HTML file in a single html code block, and nothing else.'
export const SKILLS_DIR = join(ROOT, '..', '..', 'plugin', 'skills')

/** Skills left out of the bench prompt, because the bench builds pages and these are not design skills. */
const NOT_BENCHED = new Set(['dualkit-convert'])

const skillNames = (skillsDir: string) => readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()

/** Run once before any API call, so a missing skill stops the run before it spends quota on the alone builds. */
export function checkSkills(skillsDir = SKILLS_DIR): void {
  if (!existsSync(skillsDir)) throw new BenchError(`No skills folder at ${skillsDir}.`)
  const names = skillNames(skillsDir)
  if (names.length === 0) throw new BenchError(`The skills folder ${skillsDir} has no skills.`)
  const broken = names.filter((name) => !existsSync(join(skillsDir, name, 'SKILL.md')))
  if (broken.length > 0) throw new BenchError(`These skills have no SKILL.md: ${broken.join(', ')}.`)
}

/** With Dualkit, the four design skills go in whole, as Claude Code loads them when they fire. */
export function systemPrompt(condition: Condition, skillsDir = SKILLS_DIR): string {
  if (condition === 'alone') return BASE_SYSTEM
  return [BASE_SYSTEM, ...skillNames(skillsDir).filter((name) => !NOT_BENCHED.has(name)).map((name) => `# Skill: ${name}\n\n${readFileSync(join(skillsDir, name, 'SKILL.md'), 'utf8').trim()}`)].join('\n\n')
}
