import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fixtureRepo } from './helpers'

describe('fixtureRepo', () => {
  it.each([
    ['next-app', 'app/layout.tsx'],
    ['vite-app', 'src/main.tsx'],
  ] as const)('copies %s and commits it', (name, file) => {
    const dir = fixtureRepo(name)
    expect(existsSync(join(dir, file))).toBe(true)
    const status = execFileSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' })
    expect(status).toBe('')
  })
})
