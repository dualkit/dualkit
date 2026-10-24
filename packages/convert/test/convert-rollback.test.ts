import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { convert } from '../src/convert'
import { fixtureRepo } from './helpers'

const failing = vi.hoisted(() => ({ wiring: false }))

vi.mock('../src/apply', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/apply')>()
  return {
    ...real,
    applyPlan: async (...args: Parameters<typeof real.applyPlan>) => {
      const applied = await real.applyPlan(...args)
      if (failing.wiring) throw new Error('forced wiring failure')
      return applied
    },
  }
})

afterEach(() => { failing.wiring = false })

const git = (dir: string, ...args: string[]): string => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim()
const io = { log: () => {}, run: async () => ({ code: 0, out: '' }), config: {} }
const options = (root: string) => ({ root, mode: 'bilingual' as const, install: false, baseline: false })

function failingHook(dir: string): void {
  const hook = join(dir, '.git/hooks/pre-commit')
  writeFileSync(hook, '#!/bin/sh\nexit 1\n')
  chmodSync(hook, 0o755)
}

/** The repo is on branch with a clean tree, nothing untracked, and the original page in place. */
function expectBackOn(dir: string, branch: string): void {
  expect(git(dir, 'branch', '--show-current')).toBe(branch)
  expect(git(dir, 'status', '--porcelain', '--untracked-files=all')).toBe('')
  expect(existsSync(join(dir, 'app/[locale]'))).toBe(false)
  expect(existsSync(join(dir, 'messages'))).toBe(false)
}

describe('convert rollback', () => {
  it('puts the repo back on its base when the commit hook fails', async () => {
    const dir = fixtureRepo('next-app')
    failingHook(dir)
    const error = (await convert(options(dir), io).catch((e: unknown) => e)) as Error
    expect(error.message).toMatch(/^convert failed at committing: .*Your repo is back on main as it was\.$/s)
    expectBackOn(dir, 'main')
    expect(git(dir, 'branch', '--list', 'dualkit/*')).toBe('')
    expect(existsSync(join(dir, 'app/page.tsx'))).toBe(true)
  })

  it('puts the repo back on its base when wiring fails midway', async () => {
    const dir = fixtureRepo('next-app')
    failing.wiring = true
    await expect(convert(options(dir), io)).rejects.toThrow('convert failed at wiring locales: forced wiring failure. Your repo is back on main as it was.')
    expectBackOn(dir, 'main')
    expect(git(dir, 'branch', '--list', 'dualkit/*')).toBe('')
  })

  it('rolls a re-run back to the branch head and keeps the branch', async () => {
    const dir = fixtureRepo('next-app')
    await convert(options(dir), io)
    const head = git(dir, 'rev-parse', 'HEAD')
    writeFileSync(join(dir, 'components/extra.tsx'), 'export function Extra() {\n  return <p className="ml-2">More</p>\n}\n')
    git(dir, 'add', '.')
    git(dir, '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'extra')
    const extraHead = git(dir, 'rev-parse', 'HEAD')
    failingHook(dir)
    await expect(convert(options(dir), io)).rejects.toThrow('Your repo is back on dualkit/bilingual as it was.')
    expect(git(dir, 'branch', '--show-current')).toBe('dualkit/bilingual')
    expect(git(dir, 'rev-parse', 'HEAD')).toBe(extraHead)
    expect(head).not.toBe(extraHead)
    expect(git(dir, 'status', '--porcelain', '--untracked-files=all')).toBe('')
    expect(git(dir, 'show', 'HEAD:components/extra.tsx')).toContain('ml-2')
    rmSync(join(dir, '.git/hooks/pre-commit'))
  })
})
