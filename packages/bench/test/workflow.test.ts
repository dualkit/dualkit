import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT } from '../src/config'

const yml = readFileSync(join(ROOT, '..', '..', '.github', 'workflows', 'bench.yml'), 'utf8')

describe('bench workflow', () => {
  it('runs at 04:17 UTC on the 1st and by hand', () => {
    expect(yml).toContain("cron: '17 4 1 * *'")
    expect(yml).toContain('workflow_dispatch:')
  })
  it('pins Playwright and passes the keys only as secrets', () => {
    expect(yml).toContain('playwright@1.55.0')
    expect(yml).toContain('OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}')
    expect(yml).toContain('GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}')
  })
  it('never runs two benches at once and stops within three hours', () => {
    expect(yml).toMatch(/concurrency:\s*\n\s*group: bench/)
    expect(yml).toContain('timeout-minutes: 180')
  })
  it('commits only when something changed', () => {
    expect(yml).toContain('git diff --cached --quiet ||')
  })
  it('rebases over a dirty tree with autostash', () => {
    expect(yml).toContain('git pull --rebase --autostash')
  })
  it('gives the bench step its own timeout under the job timeout', () => {
    expect(yml).toMatch(/name: Run the bench\n\s+timeout-minutes: 165\n/)
    expect(yml).toContain('timeout-minutes: 180')
  })
  it('retries the pull and push three times and fails when all attempts fail', () => {
    expect(yml).toContain('for i in 1 2 3; do')
    expect(yml).toContain('if git pull --rebase --autostash && git push; then pushed=1; break; fi')
    expect(yml).toContain('[ "$pushed" -eq 1 ] || exit 1')
  })
  it('passes workflow inputs to run blocks only through env keys', () => {
    const lines = yml.split('\n').filter((line) => line.includes('${{ inputs.'))
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) {
      expect(line).toMatch(/^\s*(MONTH|MODEL): \$\{\{ inputs\.(month|model) \}\}$/)
    }
  })
})
