import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './config'
import type { Condition } from './store'

export const BASE_SYSTEM = 'You are a front-end developer. Build exactly what the user asks for. Reply with one complete, self-contained HTML file in a single html code block, and nothing else.'
const SKILLS = join(ROOT, '..', '..', 'plugin', 'skills')

/** With Dualkit, the four skills go in whole, as Claude Code loads them when they fire. */
export function systemPrompt(condition: Condition, skillsDir = SKILLS): string {
  if (condition === 'alone') return BASE_SYSTEM
  const skills = readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()
  return [BASE_SYSTEM, ...skills.map((name) => `# Skill: ${name}\n\n${readFileSync(join(skillsDir, name, 'SKILL.md'), 'utf8').trim()}`)].join('\n\n')
}
