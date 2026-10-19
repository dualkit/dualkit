import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT } from '../src/config'

const yml = readFileSync(join(ROOT, '..', '..', '.github', 'workflows', 'bench.yml'), 'utf8')

describe('bench workflow', () => {
  it('runs at 04:17 UTC on the 1st to the 3rd, so a resumable run finishes its leftovers, and by hand', () => {
    expect(yml).toContain("cron: '17 4 1-3 * *'")
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
  it('builds no summary in the run step', () => {
    const run = yml.slice(yml.indexOf('name: Run the bench'), yml.indexOf('name: Build the summary'))
    expect(run).toContain('npm run bench -w @dualkit/bench -- --no-summary')
  })
  it('builds the summary in its own step, always, within 20 minutes, before the commit', () => {
    const at = yml.indexOf('name: Build the summary')
    expect(at).toBeGreaterThan(yml.indexOf('name: Run the bench'))
    expect(at).toBeLessThan(yml.indexOf('name: Commit the results'))
    const step = yml.slice(at, yml.indexOf('name: Commit the results'))
    expect(step).toMatch(/name: Build the summary\n\s+if: always\(\)\n\s+timeout-minutes: 20\n/)
    expect(step).toContain('[ -n "$MONTH" ] && args+=(--month "$MONTH")')
    expect(step).toContain('npm run bench -w @dualkit/bench -- --summary-only "${args[@]}"')
  })
  it('sets the bot identity in its own step before the run step, and not again in the commit step', () => {
    const id = yml.indexOf('name: Set the bot identity')
    expect(id).toBeGreaterThan(-1)
    expect(id).toBeLessThan(yml.indexOf('name: Run the bench'))
    const step = yml.slice(id, yml.indexOf('name: Run the bench'))
    expect(step).toContain("git config user.name 'dualkit-bench[bot]'")
    expect(step).toContain('git config user.email')
    expect(yml.slice(yml.indexOf('name: Commit the results'))).not.toContain('git config user')
  })
  it('pushes progress every 15 minutes while the bench runs, stops the pusher and keeps the bench exit code', () => {
    const run = yml.slice(yml.indexOf('name: Run the bench'), yml.indexOf('name: Build the summary'))
    expect(run).toContain('sleep 900')
    expect(run).toContain('git add -A -- bench/runs')
    expect(run).toContain('pusher=$!')
    expect(run).toContain('kill "$pusher"')
    expect(run).toContain('exit $status')
    expect(run.indexOf('pusher=$!')).toBeLessThan(run.indexOf('npm run bench'))
    expect(run.indexOf('npm run bench')).toBeLessThan(run.indexOf('kill "$pusher"'))
    expect(run).toContain('npm run bench -w @dualkit/bench -- --no-summary "${args[@]}"')
    expect(run).toMatch(/Vercel/)
  })
  it('ignores stray temp files under bench/runs', () => {
    const ignore = readFileSync(join(ROOT, '..', '..', '.gitignore'), 'utf8').split('\n').map((l) => l.trim())
    expect(ignore).toContain('bench/runs/**/*.tmp')
  })
  it('keeps the pusher from racing the bench: no pull, a plain push of HEAD, set +e inside, and a clean stop', () => {
    const run = yml.slice(yml.indexOf('name: Run the bench'), yml.indexOf('name: Build the summary'))
    const pusher = run.slice(run.indexOf('( set +e'), run.indexOf('pusher=$!'))
    expect(pusher).toContain('set +e')
    expect(pusher).toContain('git push -q origin HEAD:${GITHUB_REF_NAME} || true')
    expect(pusher).not.toContain('--autostash')
    expect(pusher).not.toContain('git pull')
    expect(run).toContain('wait "$pusher"')
    expect(run).toContain('pkill -P "$pusher"')
  })
})
