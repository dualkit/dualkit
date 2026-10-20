import { describe, expect, it } from 'vitest'
import { lint } from '../src/run'
import { langOf, parseSource } from '../src/parse'
import { tree } from './helpers'

describe('parseSource', () => {
  it('maps extensions to languages', () => {
    expect(['a.css', 'a.scss', 'a.htm', 'a.html', 'a.mjs', 'a.cjs', 'a.jsx', 'a.mts', 'a.cts', 'a.tsx', 'a.vue'].map(langOf))
      .toEqual(['css', 'scss', 'html', 'html', 'js', 'js', 'jsx', 'ts', 'ts', 'tsx', null])
  })

  it('parses a .ts type assertion with the TypeScript plugin and no JSX', () => {
    const file = parseSource('a.ts', 'const x = <T>y\n')
    expect(file?.js).toHaveLength(1)
    expect(file?.js[0]?.lang).toBe('ts')
  })

  it('parses JSX in .tsx', () => {
    const file = parseSource('a.tsx', 'export const A = () => <div dir="rtl">hi</div>\n')
    expect(file?.js[0]?.ast.program.body).toHaveLength(1)
  })

  it('parses JSX in .js and plain JS that only parses without JSX', () => {
    expect(parseSource('a.js', 'const a = <b/>')?.js).toHaveLength(1)
    // `a <b> c` style generics are not JS, but `x < y > z` comparisons are; with JSX on, `<y>` opens an element.
    expect(parseSource('a.js', 'const r = a < b > c\n')?.js).toHaveLength(1)
  })

  it('parses a top-level return in a .cjs file', () => {
    expect(parseSource('a.cjs', 'if (module.parent) return\nmodule.exports = 1\n')?.js).toHaveLength(1)
  })

  it('parses SCSS interpolation and & nesting', () => {
    const file = parseSource('a.scss', '$side: left;\n.a { margin-#{$side}: 1px; &:hover { padding-#{$side}: 2px; } }\n')
    expect(file?.css).toHaveLength(1)
    expect(file?.css[0]?.offset).toBe(0)
    expect(file?.css[0]?.root.nodes.length).toBeGreaterThan(0)
  })

  it('splits an HTML file into its <style> and <script type="module"> blocks at the right offsets', () => {
    const text = '<!doctype html>\n<html><head><style>.a { margin-left: 1px }</style></head>\n<body><script type="module">import x from "y"; x()</script>\n<script type="application/json">{"a":1}</script></body></html>\n'
    const file = parseSource('a.html', text)
    expect(file?.html).not.toBeNull()
    expect(file?.css).toHaveLength(1)
    expect(file?.js).toHaveLength(1)
    expect(file?.css[0]?.offset).toBe(text.indexOf('.a {'))
    expect(file?.js[0]?.offset).toBe(text.indexOf('import x'))
    expect(file?.js[0]?.lang).toBe('js')
  })

  it('returns null on a syntax error', () => {
    expect(parseSource('a.ts', 'const = ;')).toBeNull()
    expect(parseSource('a.css', '.a { color: red')).toBeNull()
  })

  it('strips a leading BOM from the text', () => {
    expect(parseSource('a.css', '﻿.a{}')?.text).toBe('.a{}')
  })

  it('lists a file that does not parse in skipped and does not throw', async () => {
    const root = tree({ 'bad.ts': 'const = ;\n', 'good.ts': 'const a = 1\n' })
    const result = await lint(['.'], { cwd: root })
    expect(result.files).toBe(1)
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0]?.file).toBe('bad.ts')
    expect(result.skipped[0]?.reason).toMatch(/^parse error: \S/)
    expect(result.skipped[0]?.reason).not.toContain('\n')
  })
})
