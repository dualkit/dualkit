import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const action = readFileSync(new URL('../../../action/action.yml', import.meta.url), 'utf8')
const readme = new URL('../../../action/README.md', import.meta.url)
const hasJq = spawnSync('jq', ['--version']).status === 0

/** The run script of the PR comment step, dedented. */
function commentScript(): string {
  const lines = action.split('\n')
  const start = lines.findIndex((l) => l.includes("inputs.comment == 'true'"))
  const run = lines.findIndex((l, i) => i > start && l.trim() === 'run: |')
  const body: string[] = []
  for (const line of lines.slice(run + 1)) {
    if (line.trim() !== '' && !line.startsWith('        ')) break
    body.push(line.slice(8))
  }
  return body.join('\n')
}

/**
 * Runs the comment step with a fake gh that logs its arguments. comments null makes every API call fail.
 * The fake applies --jq with the real jq to the given comments, as gh does per page.
 */
function runCommentStep(mode: string, comments: unknown[] | null): { log: string; code: number | null; stdout: string } {
  const dir = mkdtempSync(join(tmpdir(), 'dualkit-action-'))
  writeFileSync(join(dir, 'comments.json'), JSON.stringify(comments ?? []))
  writeFileSync(join(dir, 'dualkit-summary.md'), `<!-- dualkit:${mode} -->\nsummary`)
  const gh = join(dir, 'gh')
  writeFileSync(gh, [
    '#!/usr/bin/env bash',
    'echo "$*" >> "$FAKE_DIR/log"',
    '[ "$FAKE_FAIL" = 1 ] && exit 1',
    'if [ "$1 $2" = "api user" ]; then exit 1; fi',
    'if [ "$1" = api ] && [ "$2" != -X ]; then',
    '  while [ $# -gt 0 ]; do if [ "$1" = --jq ]; then jq -r "$2" "$FAKE_DIR/comments.json"; exit $?; fi; shift; done',
    'fi',
    'exit 0',
  ].join('\n'))
  chmodSync(gh, 0o755)
  const result = spawnSync('bash', ['-e', '-c', commentScript()], {
    cwd: dir, encoding: 'utf8',
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, FAKE_DIR: dir, FAKE_FAIL: comments === null ? '1' : '0', GITHUB_REPOSITORY: 'o/r', PR: '5', MODE: mode, GH_TOKEN: 'x' },
  })
  const log = existsSync(join(dir, 'log')) ? readFileSync(join(dir, 'log'), 'utf8') : ''
  return { log, code: result.status, stdout: result.stdout }
}

describe('the GitHub Action', () => {
  it('starts each summary with a hidden marker for its mode and never uses --edit-last', () => {
    expect(action).toContain("'<!-- dualkit:check -->'")
    expect(action).toContain("'<!-- dualkit:lint -->'")
    expect(action).not.toContain('--edit-last')
  })

  describe.skipIf(!hasJq)('the comment step, run against a fake gh', () => {
    it('patches the comment with its own marker, leaving the other mode alone', () => {
      const comments = [
        { id: 1, user: { login: 'github-actions[bot]' }, body: '<!-- dualkit:check -->\nold check' },
        { id: 2, user: { login: 'github-actions[bot]' }, body: '<!-- dualkit:lint -->\nold lint' },
        { id: 3, user: { login: 'someone' }, body: '<!-- dualkit:lint -->\nquoted by a person' },
      ]
      const { log, code, stdout } = runCommentStep('lint', comments)
      expect(code).toBe(0)
      expect(log).toContain('api -X PATCH repos/o/r/issues/comments/2 -F body=@dualkit-summary.md')
      expect(log).not.toContain('comments/1 ')
      expect(log).not.toContain('pr comment')
      expect(stdout).not.toContain('Could not comment')
    })

    it('creates a comment when none of its mode exists', () => {
      const { log, code } = runCommentStep('check', [{ id: 2, user: { login: 'github-actions[bot]' }, body: '<!-- dualkit:lint -->\nlint' }])
      expect(code).toBe(0)
      expect(log).toContain('pr comment 5 --repo o/r --body-file dualkit-summary.md')
      expect(log).not.toContain('PATCH')
    })

    it('logs the fallback message and exits 0 when the API refuses', () => {
      const { code, stdout } = runCommentStep('lint', null)
      expect(code).toBe(0)
      expect(stdout).toContain('Could not comment; grant pull-requests write to enable it.')
    })
  })

  it('has a README that documents every input and output, Node 22, the permission and a preview URL', () => {
    expect(existsSync(readme)).toBe(true)
    const text = readFileSync(readme, 'utf8')
    const inputs = [...action.matchAll(/^ {2}([a-z-]+): \{ description/gm)].map((m) => m[1]!)
    expect(inputs.length).toBeGreaterThan(5)
    for (const name of [...inputs, 'score']) expect(text, name).toContain(`\`${name}\``)
    expect(text).toContain('Node 22')
    expect(text).toContain('pull-requests: write')
    expect(text).toMatch(/preview/i)
    expect(text).not.toContain('—')
  })
})
