import { describe, expect, it } from 'vitest'
import { lint } from '../src/run'
import { langOf, parseSource } from '../src/parse'
import { tree } from './helpers'

describe('parseSource', () => {
  it('maps extensions to languages', () => {
    expect(['a.css', 'a.scss', 'a.htm', 'a.html', 'a.mjs', 'a.cjs', 'a.jsx', 'a.mts', 'a.cts', 'a.tsx', 'a.vue', 'a.svelte', 'a.md'].map(langOf))
      .toEqual(['css', 'scss', 'html', 'html', 'js', 'js', 'jsx', 'ts', 'ts', 'tsx', 'vue', 'svelte', null])
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

describe('parseSource decorators and Flow', () => {
  it('parses decorators in .ts and .tsx and keeps <T>y casts in .ts', () => {
    expect(parseSource('a.ts', "@Injectable()\nexport class S {}\nconst x = <T>y\n")?.js).toHaveLength(1)
    expect(parseSource('a.tsx', "@Component({})\nexport class C { @Input() v = 1 }\nexport const A = () => <div/>\n")?.js).toHaveLength(1)
  })

  it('retries a .js or .jsx file with an @flow pragma using the Flow plugin', () => {
    expect(parseSource('a.js', '// @flow\nfunction f(x: number): string { return String(x) }\n')?.js).toHaveLength(1)
    expect(parseSource('a.jsx', '/* @flow */\ntype P = { n: number }\nexport const A = (p: P) => <b>{p.n}</b>\n')?.js).toHaveLength(1)
  })

  it('does not parse Flow types without a pragma', () => {
    expect(parseSource('a.js', 'function f(x: number): string { return String(x) }\n')).toBeNull()
  })
})

describe('parseSource Vue and Svelte', () => {
  const vue = '<template>\n  <div class="ml-2">x</div>\n</template>\n<style lang="scss" scoped>\n.a { margin-left: 1px; .b { padding-right: 2px } }\n</style>\n<script setup lang="ts">\nconst a: number = 1\n</script>\n'

  it('splits a .vue file into scss, ts and html with offsets into the text', () => {
    const file = parseSource('a.vue', vue)
    expect(file?.html).not.toBeNull()
    expect(file?.css).toHaveLength(1)
    expect(file?.js).toHaveLength(1)
    expect(file?.js[0]?.lang).toBe('ts')
    expect(vue.slice(file?.css[0]?.offset).startsWith('\n.a { margin-left')).toBe(true)
    expect(vue.slice(file?.js[0]?.offset).startsWith('\nconst a')).toBe(true)
  })

  it('splits a .svelte file with top-level markup', () => {
    const text = '<script lang="ts">let n: number = 1</script>\n<p class="pl-4">{n}</p>\n<style>p { margin-left: 1px }</style>\n'
    const file = parseSource('a.svelte', text)
    expect(file?.js[0]?.lang).toBe('ts')
    expect(file?.css).toHaveLength(1)
    expect(file?.html).not.toBeNull()
  })

  it('reads lang="tsx" as tsx and skips less, stylus and sass blocks', () => {
    const text = '<script lang="tsx">export const A = () => <b/></script>\n<style lang="less">.a { margin-left: 1px }</style><style lang="stylus">a\n  margin-left 1px</style><style lang="sass">.a\n  margin-left: 1px</style>'
    const file = parseSource('a.vue', text)
    expect(file?.js[0]?.lang).toBe('tsx')
    expect(file?.css).toEqual([])
  })

  it('skips a .vue file whose script does not parse', async () => {
    const root = tree({ 'a.vue': '<template><i/></template><script>const = </script>' })
    const result = await lint(['.'], { cwd: root })
    expect(result.skipped[0]?.reason).toMatch(/^parse error:/)
  })

  it('ignores non-JS script types in a component and reads the markup', async () => {
    const root = tree({
      'package.json': '{"devDependencies":{"tailwindcss":"^3.4.0"}}', 'node_modules/tailwindcss/package.json': '{"name":"tailwindcss","version":"3.4.17"}',
      'index.html': '<html dir="rtl"></html>',
      'ld.svelte': '<svelte:head><script type="application/ld+json">{"@context":"https://schema.org"}</script></svelte:head><p class="ml-2">x</p>',
    })
    const result = await lint(['.'], { cwd: root })
    expect(result.skipped).toEqual([])
    expect(result.findings.map((f) => f.rule)).toContain('source/physical-tailwind')
  })

  it('does not read a non-HTML template as markup but keeps its style and script', () => {
    const text = '<template lang="pug">\np.x text <b class="mr-3">\n</template>\n<style>.a { margin-left: 1px }</style>\n<script>const a = 1</script>\n'
    const file = parseSource('a.vue', text)
    expect(file?.css).toHaveLength(1)
    expect(file?.js).toHaveLength(1)
    const classes: string[] = []
    const walk = (n: any): void => { if (n.attrs) for (const a of n.attrs) if (a.name === 'class') classes.push(a.value); for (const c of n.childNodes ?? []) walk(c); if (n.content) walk(n.content) }
    walk(file?.html)
    expect(classes).toEqual([])
  })
})
