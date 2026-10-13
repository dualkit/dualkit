import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseSkill, renderCursorRule } from './skill-file.mjs'

const ROOT = join(import.meta.dirname, '../../..')
const SKILLS = join(ROOT, 'skills')
const RULES = join(ROOT, 'cursor/rules')

rmSync(RULES, { recursive: true, force: true })
mkdirSync(RULES, { recursive: true })
for (const name of readdirSync(SKILLS)) {
  const file = join(SKILLS, name, 'SKILL.md')
  if (!existsSync(file)) continue
  writeFileSync(join(RULES, `${name}.mdc`), renderCursorRule(parseSkill(readFileSync(file, 'utf8'))))
  console.log(`cursor/rules/${name}.mdc`)
}
