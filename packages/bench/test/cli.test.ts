import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT } from '../src/config'
import { SITE_ROOT } from '../src/summary'

// The real CLI, as the workflow calls it. 2098-07 has no builds in bench/runs, so nothing is written anywhere.
const cli = (...args: string[]) => spawnSync(process.execPath, ['--import', 'tsx', join(ROOT, 'src', 'cli.ts'), ...args], { cwd: ROOT, encoding: 'utf8' })

describe('the CLI', () => {
  it('prints the resolved month and exits 0 with --print-month', () => {
    const out = cli('--print-month', '--month', '2026-11')
    expect(out.status).toBe(0)
    expect(out.stdout).toBe('2026-11\n')
  })
  it('prints the current UTC month when no month is given', () => {
    const out = cli('--print-month')
    expect(out.stdout.trim()).toMatch(/^\d{4}-\d{2}$/)
  })
  it('rejects a bad month with --print-month, so the workflow stops before it runs', () => {
    expect(cli('--print-month', '--month', 'Nov').status).toBe(2)
  })
  it('exits 1 with a clear message and writes no summary when the month has no successful build', () => {
    const out = cli('--summary-only', '--month', '2098-07')
    expect(out.status).toBe(1)
    expect(out.stderr).toMatch(/no successful build/i)
    expect(existsSync(join(SITE_ROOT, 'content', 'bench', '2098-07.json'))).toBe(false)
  })
})
