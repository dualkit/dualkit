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
})
