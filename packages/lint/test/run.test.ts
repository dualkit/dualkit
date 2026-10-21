import { describe, expect, it } from 'vitest'
import { RULES } from '../src/rules'
import { lint, lintDocsUrl, lintText } from '../src/run'
import { tree, wordRule } from './helpers'

const bad = wordRule('test/bad', 'bad')
const worse = wordRule('test/worse', 'worse')

describe('lintText', () => {
  it('gives 1-based line and column in CRLF text', () => {
    const [f] = lintText('a.css', '.a {}\r\n.b {}\r\n  .bad {}\r\n', { rules: [bad] })
    expect(f).toMatchObject({ line: 3, column: 4, file: 'a.css', rule: 'test/bad', group: 'source', severity: 'warning' })
  })

  it('counts a lone CR as a line end', () => {
    const [f] = lintText('a.css', '.a {}\r.bad {}', { rules: [bad] })
    expect(f).toMatchObject({ line: 2, column: 2 })
  })

  it('gives the right line and column in text with a BOM', () => {
    const findings = lintText('a.ts', '﻿const bad = 1\r\nlet x = bad\n', { rules: [bad] })
    expect(findings.map((f) => [f.line, f.column])).toEqual([[1, 7], [2, 9]])
  })

  it('counts columns in UTF-16 code units', () => {
    const [f] = lintText('a.ts', 'const s = "😀"; const bad = 1\n', { rules: [bad] })
    expect(f?.column).toBe(23)
  })

  it('fills the finding from the rule', () => {
    const [f] = lintText('a.css', '.bad{}', { rules: [bad] })
    expect(f).toEqual({
      rule: 'test/bad', group: 'source', severity: 'warning', title: 'No bad', message: 'Found bad.', fix: 'Remove bad.',
      docs: lintDocsUrl('test/bad'), file: 'a.css', line: 1, column: 2,
    })
  })

  it('drops a rule named in ignore', () => {
    expect(lintText('a.css', '.bad .worse {}', { rules: [bad, worse], ignore: ['test/bad'] }).map((f) => f.rule)).toEqual(['test/worse'])
  })

  it('runs a rule only on its languages', () => {
    const cssOnly = wordRule('test/css', 'bad', ['css'])
    expect(lintText('a.ts', 'const bad = 1', { rules: [cssOnly] })).toEqual([])
    expect(lintText('a.css', '.bad{}', { rules: [cssOnly] })).toHaveLength(1)
  })

  it('sorts by line, column, then rule', () => {
    const bad2 = wordRule('test/a-bad', 'bad')
    const findings = lintText('a.css', '.worse .bad {}\n.bad {}\n', { rules: [worse, bad, bad2] })
    expect(findings.map((f) => `${f.line}:${f.column}:${f.rule}`)).toEqual(['1:2:test/worse', '1:9:test/a-bad', '1:9:test/bad', '2:2:test/a-bad', '2:2:test/bad'])
  })

  it('passes a context whose tailwindVersion defaults to null and can be replaced', () => {
    const seen: (string | null)[] = []
    const probe = { ...bad, check: (file: Parameters<typeof bad.check>[0], ctx: Parameters<typeof bad.check>[1]) => { seen.push(ctx.tailwindVersion(file)); return [] } }
    lintText('a.css', '', { rules: [probe] })
    lintText('a.css', '', { rules: [probe], ctx: { tailwindVersion: () => '4.1.0' } })
    expect(seen).toEqual([null, '4.1.0'])
  })

  it('returns nothing for a file that does not parse or an unknown extension', () => {
    expect(lintText('a.ts', 'const bad = ;', { rules: [bad] })).toEqual([])
    expect(lintText('a.vue', 'bad', { rules: [bad] })).toEqual([])
  })
})

describe('lint', () => {
  it('sorts findings by file, then line', async () => {
    const root = tree({ 'b.css': '.bad{}', 'a/z.css': '\n.bad{}', 'a/y.css': '.x{}\n\n.bad{}' })
    const result = await lint(['.'], { cwd: root, rules: [bad] })
    expect(result.root).toBe(root)
    expect(result.files).toBe(3)
    expect(result.findings.map((f) => `${f.file}:${f.line}`)).toEqual(['a/y.css:3', 'a/z.css:2', 'b.css:1'])
  })

  it('skips a one-line 600 KB file as minified before parsing it', async () => {
    const root = tree({ 'app.min.js': `var bad=${'1+'.repeat(300_000)}1;`, 'ok.js': 'var bad = 1\n' })
    const result = await lint(['.'], { cwd: root, rules: [bad] })
    expect(result.files).toBe(1)
    expect(result.skipped).toEqual([{ file: 'app.min.js', reason: 'minified' }])
    expect(result.findings.map((f) => f.file)).toEqual(['ok.js'])
  })

  it('honours ignore', async () => {
    const root = tree({ 'a.css': '.bad .worse{}' })
    const result = await lint(['.'], { cwd: root, rules: [bad, worse], ignore: ['test/worse'] })
    expect(result.findings.map((f) => f.rule)).toEqual(['test/bad'])
  })

  it('carries the walker skips into the result', async () => {
    const root = tree({ 'a.css': '' })
    expect((await lint(['missing'], { cwd: root })).skipped).toEqual([{ file: 'missing', reason: 'not found' }])
  })
})

describe('lintDocsUrl', () => {
  it('points at the rule anchor in LINT.md', () => {
    expect(lintDocsUrl('source/physical-css')).toBe('https://github.com/dualkit/dualkit/blob/main/packages/lint/LINT.md#source-physical-css')
  })
})

describe('lint quiet files', () => {
  const tw = JSON.stringify({ devDependencies: { rtlcss: '^4', tailwindcss: '^3.4.0' } })
  const installed = JSON.stringify({ name: 'tailwindcss', version: '3.4.17' })

  it('silences physical-css under a flipper but not physical-tailwind', async () => {
    const root = tree({
      'package.json': tw, 'node_modules/tailwindcss/package.json': installed,
      'a.scss': '.a { margin-left: 4px }', 'b.tsx': 'export const B = () => <div className="ml-2" />',
    })
    const result = await lint(['.'], { cwd: root })
    expect(result.findings.map((f) => f.rule)).toEqual(['source/physical-tailwind'])
    expect(result.quiet).toContainEqual({ reason: 'flipped', files: 1, flipper: 'rtlcss' })
  })

  it('reads classes, styles and inline styles in a .vue file with correct lines', async () => {
    const root = tree({
      'package.json': tw, 'node_modules/tailwindcss/package.json': installed, 'index.html': '<html dir="rtl"></html>',
      'a.vue': '<template>\n  <div class="pl-4">\n    <template v-if="ok">\n      <p class="mr-2">x</p>\n    </template>\n  </div>\n</template>\n<style scoped>\n.a {\n  margin-left: 1px;\n}\n</style>\n',
    })
    const result = await lint(['.'], { cwd: root })
    expect(result.findings.map((f) => [f.rule, f.line])).toEqual(expect.arrayContaining([
      ['source/physical-tailwind', 2], ['source/physical-tailwind', 4], ['source/physical-css', 10],
    ]))
  })

  it('treats a dir attribute in a Vue template as deliberate', async () => {
    const root = tree({
      'package.json': tw, 'node_modules/tailwindcss/package.json': installed,
      'index.html': '<html dir="rtl"></html>',
      'a.vue': '<template>\n  <div dir="ltr" class="pl-4">x</div>\n</template>\n',
    })
    const result = await lint(['.'], { cwd: root })
    expect(result.findings.filter((f) => f.rule === 'source/physical-tailwind')).toEqual([])
  })

  it('silences example files', async () => {
    const root = tree({ 'examples/a.css': '.a { margin-left: 4px }' })
    const result = await lint(['.'], { cwd: root })
    expect(result.findings).toEqual([])
    expect(result.quiet).toContainEqual({ reason: 'example', files: 1 })
  })

  it('leaves the dir attribute rule out by default', async () => {
    const root = tree({ 'a.scss': '[dir="rtl"] .x { margin-right: 0 }' })
    expect((await lint(['.'], { cwd: root })).findings.map((f) => f.rule)).not.toContain('source/dir-attribute-selector')
    expect((await lint(['.'], { cwd: root, rules: RULES })).findings.map((f) => f.rule)).toContain('source/dir-attribute-selector')
  })

  it('reports no quiet files from lintText', () => {
    expect(lintText('examples/a.css', '.a { margin-left: 4px }').map((f) => f.rule)).toEqual(['source/physical-css'])
  })
})

describe('lint with no right-to-left support', () => {
  const three = (extra: Record<string, string> = {}): Record<string, string> => ({
    'a.css': '.a { margin-left: 4px }', 'b.css': '.b { padding-right: 4px }', 'c.css': '.c { left: 2px }', ...extra,
  })

  it('collapses the physical findings into one note at the first of them', async () => {
    const result = await lint(['.'], { cwd: tree(three()) })
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]).toMatchObject({
      rule: 'source/no-rtl-support', severity: 'note', file: 'a.css', line: 1,
      message: '3 sides are set left or right. This repo has no right-to-left support yet; start here.',
    })
  })

  it('reports the findings as usual with one rtl: class anywhere', async () => {
    const result = await lint(['.'], { cwd: tree(three({ 'd.tsx': 'export const D = () => <i className="rtl:mr-2" />' })) })
    expect(result.findings.map((f) => f.rule)).toEqual(['source/physical-css', 'source/physical-css', 'source/physical-css'])
  })

  it('reports the findings as usual when a locale file exists', async () => {
    const result = await lint(['.'], { cwd: tree(three({ 'public/locales/ar.json': '{}' })) })
    expect(result.findings.map((f) => f.rule)).toEqual(['source/physical-css', 'source/physical-css', 'source/physical-css'])
  })

  it('keeps the findings when only a subset of the repo is linted', async () => {
    const cwd = tree({ 'src/app.tsx': '<html dir="rtl" />', 'a/x.css': '.a { margin-left: 4px }' })
    const result = await lint(['a/x.css'], { cwd })
    expect(result.findings.map((f) => f.rule)).toEqual(['source/physical-css'])
  })

  it('still collapses when linting the repo top as a dot', async () => {
    const result = await lint(['.'], { cwd: tree({ 'a/x.css': '.a { margin-left: 4px }' }) })
    expect(result.findings.map((f) => f.rule)).toEqual(['source/no-rtl-support'])
  })

  it('keeps the individual findings when the summary is ignored', async () => {
    const result = await lint(['.'], { cwd: tree(three()), ignore: ['source/no-rtl-support'] })
    expect(result.findings).toHaveLength(3)
  })

  it('adds nothing when there are no physical findings', async () => {
    expect((await lint(['.'], { cwd: tree({ 'a.css': '.a { margin-inline-start: 4px }' }) })).findings).toEqual([])
  })

  it('writes a thousands separator in the count', async () => {
    const css = Array.from({ length: 1200 }, (_, i) => `.a${i} { margin-left: ${i + 1}px }`).join('\n')
    const result = await lint(['.'], { cwd: tree({ 'a.css': css }) })
    expect(result.findings[0]?.message).toMatch(/^1,200 sides are set/)
  })
})
