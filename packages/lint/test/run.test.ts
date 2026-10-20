import { describe, expect, it } from 'vitest'
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
