import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { NO_GIT, commit, currentBranch } from '../src/git'

describe('git', () => {
  it('names a missing folder instead of blaming git', async () => {
    const missing = join(tmpdir(), `dualkit-missing-${process.pid}-${Date.now()}`)
    const error = (await currentBranch(missing).catch((e: unknown) => e)) as Error
    expect(error.message).not.toBe(NO_GIT)
    expect(error.message).toBe(`The folder ${missing} does not exist.`)
  })
  it('commits past a pre-commit hook that fails', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dualkit-hook-'))
    const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' })
    git('init', '-q')
    git('config', 'user.name', 'test')
    git('config', 'user.email', 'test@example.com')
    writeFileSync(join(dir, '.git/hooks/pre-commit'), '#!/bin/sh\nexit 1\n', { mode: 0o755 })
    writeFileSync(join(dir, 'a.txt'), 'a')
    git('add', 'a.txt')
    await commit(dir, 'first')
    expect(git('log', '--format=%s').trim()).toBe('first')
  })
})
