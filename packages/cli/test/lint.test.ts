import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LintResult } from '@dualkit/lint'
import { describe, expect, it } from 'vitest'
import { run } from '../src/cli'
import { formatLint, formatSkipped } from '../src/lint'

const project = (files: Record<string, string>) => {
  const dir = mkdtempSync(join(tmpdir(), 'dualkit-lint-'))
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true })
    writeFileSync(join(dir, name), text)
  }
  return dir
}

const harness = (cwd: string) => {
  const out: string[] = []
  const err: string[] = []
  return {
    out, err,
    io: {
      out: (s: string) => out.push(s), err: (s: string) => err.push(s), write: () => {},
      audit: async () => { throw new Error('lint must not launch a browser') }, cwd,
    },
  }
}

/** physical-css, a note. */
const WARN = '.a { margin-left: 8px; }\n'
/** The bare islamic calendar, a warning. */
const WARN_ISLAMIC = "<script>new Intl.DateTimeFormat('ar', { calendar: 'islamic' }).format(5)</script>\n"
/** A locale file is a right-to-left signal, so the physical finding is reported on its own instead of collapsing into the repo note. */
const RTL = { 'locales/ar.json': '{}' }
const CLEAN = '.a { margin-inline-start: 8px; }\n'

describe('dualkit lint', () => {
  it('exits 0 on clean code, with no browser', async () => {
    const t = harness(project({ 'a.css': CLEAN }))
    expect(await run(['lint'], t.io)).toBe(0)
    expect(t.out.join('')).toContain('No issues found in 1 file.')
  })

  it('exits 0 on warnings at the default fail-on, 1 at --fail-on warning', async () => {
    const cwd = project({ 'a.html': WARN_ISLAMIC, ...RTL })
    expect(await run(['lint', '.'], harness(cwd).io)).toBe(0)
    expect(await run(['lint', '.', '--fail-on', 'warning'], harness(cwd).io)).toBe(1)
    expect(await run(['lint', '.', '--fail-on', 'note'], harness(cwd).io)).toBe(1)
  })

  it('a note does not fail at --fail-on warning, only at --fail-on note', async () => {
    const cwd = project({ 'a.css': WARN, ...RTL })
    expect(await run(['lint', '.'], harness(cwd).io)).toBe(0)
    expect(await run(['lint', '.', '--fail-on', 'warning'], harness(cwd).io)).toBe(0)
    expect(await run(['lint', '.', '--fail-on', 'note'], harness(cwd).io)).toBe(1)
  })

  it('exits 1 on an error finding', async () => {
    const t = harness(project({ 'a.css': '[lang="ar"] { letter-spacing: 2px; }\n' }))
    expect(await run(['lint', '--json'], t.io)).toBe(1)
    expect((JSON.parse(t.out.join('')) as LintResult).findings[0]!.severity).toBe('error')
  })

  it('exits 2 for a bad --fail-on and for a missing path, naming it', async () => {
    const cwd = project({ 'a.css': CLEAN })
    const bad = harness(cwd)
    expect(await run(['lint', '--fail-on', 'bogus'], bad.io)).toBe(2)
    expect(bad.err.join('')).toContain('bogus')
    const missing = harness(cwd)
    expect(await run(['lint', 'nope/dir'], missing.io)).toBe(2)
    expect(missing.err.join('')).toContain('nope/dir')
  })

  it('prints the LintResult with --json, files relative to cwd with forward slashes', async () => {
    const t = harness(project({ 'src/ui/a.css': WARN }))
    expect(await run(['lint', '--json'], t.io)).toBe(0)
    const result = JSON.parse(t.out.join('')) as LintResult
    expect(result.findings[0]!.file).toBe('src/ui/a.css')
    expect(result.files).toBe(1)
  })

  it('prints path:line:col lines and totals', async () => {
    const t = harness(project({ 'a.css': WARN, ...RTL }))
    await run(['lint', '--fail-on', 'error'], t.io)
    const text = t.out.join('')
    expect(text).toMatch(/a\.css:1:\d+ {2}· /)
    expect(text).toMatch(/0 errors, 0 warnings, 1 note in 1 file/)
  })

  it('config ignore drops a lint id, rejects unknown ids, accepts check ids', async () => {
    const cwd = project({ 'a.css': WARN, ...RTL })
    const first = harness(cwd)
    await run(['lint', '--json'], first.io)
    const id = (JSON.parse(first.out.join('')) as LintResult).findings[0]!.rule

    writeFileSync(join(cwd, 'dualkit.config.json'), JSON.stringify({ ignore: [id, 'type/arabic-size'] }))
    const ignored = harness(cwd)
    expect(await run(['lint', '--json', '--fail-on', 'note'], ignored.io)).toBe(0)
    expect((JSON.parse(ignored.out.join('')) as LintResult).findings).toEqual([])

    writeFileSync(join(cwd, 'dualkit.config.json'), JSON.stringify({ ignore: ['nope/not-a-rule'] }))
    const unknown = harness(cwd)
    expect(await run(['lint'], unknown.io)).toBe(2)
    expect(unknown.err.join('')).toContain('nope/not-a-rule')
  })

  it('does not import the browser audit at the top of cli.ts', () => {
    const source = readFileSync(new URL('../src/cli.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/^import \{[^}]*\} from '\.\/audit'/m)
  })
})

describe('formatLint', () => {
  const base: LintResult = { root: '/x', files: 2, skipped: [], findings: [], quiet: [] }
  it('lists quiet files, one line per reason', () => {
    const text = formatLint({ ...base, quiet: [{ reason: 'flipped', files: 2249, flipper: 'rtlcss' }, { reason: 'example', files: 12 }, { reason: 'generated', files: 3 }, { reason: 'email', files: 5 }] }, false)
    expect(text).toContain('Skipped physical rules in 2,249 files flipped by rtlcss.')
    expect(text).toContain('Skipped physical rules in 12 example files.')
    expect(text).toContain('Skipped physical rules in 3 generated files.')
    expect(text).toContain('Skipped physical rules in 5 email templates.')
  })
  it('uses singular nouns for one file', () => {
    const text = formatLint({ ...base, quiet: [{ reason: 'email', files: 1 }, { reason: 'example', files: 1 }, { reason: 'generated', files: 1 }, { reason: 'flipped', files: 1, flipper: 'rtlcss' }] }, false)
    expect(text).toContain('in 1 email template.')
    expect(text).toContain('in 1 example file.')
    expect(text).toContain('in 1 generated file.')
    expect(text).toContain('in 1 file flipped by rtlcss.')
  })
  it('says no issues, and leaves skipped files to formatSkipped', () => {
    const result = { ...base, skipped: [{ file: 'big.js', reason: 'minified' }] }
    const text = formatLint(result, false)
    expect(text).toContain('No issues found in 2 files.')
    expect(text).not.toContain('skipped')
    expect(formatSkipped(result)).toBe('skipped big.js: minified\n')
    expect(formatSkipped(base)).toBe('')
  })
  it('colours marks only when asked', () => {
    const finding = { rule: 'r/x', group: 'source', severity: 'error', title: 't', message: 'm', fix: 'f', docs: 'd', file: 'a.css', line: 3, column: 5 } as const
    expect(formatLint({ ...base, findings: [finding] }, false)).toContain('a.css:3:5  ✖ r/x  m')
    expect(formatLint({ ...base, findings: [finding] }, true)).toContain('\u001b[31m✖')
  })
})

describe('dualkit lint streams and flags', () => {
  it('writes skipped files to stderr, not stdout', async () => {
    const t = harness(project({ 'a.css': CLEAN, 'b.ts': 'const = ;\n' }))
    expect(await run(['lint'], t.io)).toBe(0)
    expect(t.out.join('')).not.toContain('skipped')
    expect(t.err.join('')).toContain('skipped b.ts:')
  })

  it('keeps --json stdout pure JSON and prints no skipped lines', async () => {
    const t = harness(project({ 'b.ts': 'const = ;\n' }))
    expect(await run(['lint', '--json'], t.io)).toBe(0)
    expect(JSON.parse(t.out.join('')).skipped).toHaveLength(1)
    expect(t.err.join('')).toBe('')
  })

  it.each([['--width', '400'], ['--height', '600'], ['--out', 'r.html'], ['--min-score', '80']])('rejects the check-only flag %s with exit 2', async (flag, value) => {
    const t = harness(project({ 'a.css': CLEAN }))
    expect(await run(['lint', flag, value], t.io)).toBe(2)
    expect(t.err.join('')).toContain(`${flag} is a dualkit check option`)
    expect(t.out.join('')).toBe('')
  })
})
