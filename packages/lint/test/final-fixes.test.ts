import { describe, expect, it } from 'vitest'
import { lint, lintText } from '../src/run'
import { maskSvelteExpressions } from '../src/svelte-mask'
import { tree } from './helpers'

const rules = (path: string, text: string, rule: string) => lintText(path, text).filter((f) => f.rule === rule)

describe('template placeholders are unknown values', () => {
  it.each(['${(p) => p.ls}', '${(p) => p.ls}em', '${a}px'])('arabic-letter-spacing skips %s', (value) => {
    const text = `export const A = styled.p\`\n  &:lang(ar) { letter-spacing: ${value}; }\n\`\n`
    expect(rules('a.ts', text, 'source/arabic-letter-spacing')).toEqual([])
  })

  it('arabic-letter-spacing still fires on a literal value in a template', () => {
    const text = 'export const A = styled.p`\n  &:lang(ar) { letter-spacing: 2px; }\n`\n'
    expect(rules('a.ts', text, 'source/arabic-letter-spacing')).toHaveLength(1)
  })

  it('two placeholders of the same length are not a symmetric pair', () => {
    const text = 'export const A = styled.p`\n  margin-left: ${a};\n  margin-right: ${b};\n`\n'
    expect(rules('a.ts', text, 'source/physical-css').map((f) => f.line)).toEqual([2, 3])
  })

  it('equal literal values are still a symmetric pair', () => {
    const text = 'export const A = styled.p`\n  margin-left: 4px;\n  margin-right: 4px;\n`\n'
    expect(rules('a.ts', text, 'source/physical-css')).toEqual([])
  })
})

describe('messages from template CSS in component scripts', () => {
  it('show source text in a .vue script block', () => {
    const text = '<script setup lang="ts">\nconst Box = styled.div`\n  margin-left: ${(p: any) => p.gap}px;\n`\n</script>\n'
    const [f] = rules('Comp.vue', text, 'source/physical-css')
    expect(f?.message).toBe('`margin-left: ${(p: any) => p.gap}px` is tied to one side. Use `margin-inline-start`.')
  })

  it('keep the parsed value for a Vue style block', () => {
    const [f] = rules('Comp.vue', '<template><i/></template>\n<style>\n.a { margin-left: 1PX; }\n</style>\n', 'source/physical-css')
    expect(f?.message).toContain('`margin-left: 1px`')
  })
})

describe('Svelte attribute expressions', () => {

  it('masks to the same length', () => {
    const text = '<button on:click={() => a > b} class="ml-2">{`x > ${y}`}</button>\n<script>let s = "{"</script>'
    const masked = maskSvelteExpressions(text)
    expect(masked).toHaveLength(text.length)
    expect(masked).toContain('class="ml-2"')
    expect(masked).not.toContain('=> a > b')
    expect(masked).toContain('let s = "{"')
  })

  it.each([
    '<button on:click={() => a > b} class="ml-2">x</button>',
    '<button on:click={() => { if (a > b) go({ x: "}" }) }} class="ml-2">x</button>',
    '<button on:click={() => go(`${a > b}`)} class="ml-2">x</button>',
    '<p>{a < b}</p><i class="ml-2"></i>',
  ])('reports ml-2 on the right line after %s', async (markup) => {
    const root = tree({
      'package.json': JSON.stringify({ devDependencies: { tailwindcss: '^3.4.0' } }),
      'node_modules/tailwindcss/package.json': JSON.stringify({ name: 'tailwindcss', version: '3.4.17' }),
      'index.html': '<html dir="rtl"></html>',
      'A.svelte': `<script>\n  let a = 1\n</script>\n\n${markup}\n`,
    })
    const result = await lint(['.'], { cwd: root })
    expect(result.findings.filter((f) => f.rule === 'source/physical-tailwind').map((f) => f.line)).toEqual([5])
  })
})

describe('flippers quiet what they process', () => {
  const sheet = '.a { margin-left: 1px }'
  const script = 'export const A = styled.div`\n  margin-left: 1px;\n`\n'
  const vue = `<template><i/></template>\n<style>\n${sheet}\n</style>\n<script lang="ts">\n${script}</script>\n`
  const physicalLines = async (flipper: string, files: Record<string, string>) => {
    const root = tree({ 'package.json': JSON.stringify({ dependencies: { [flipper]: '1' } }), ...files })
    const result = await lint(['.'], { cwd: root })
    return result.findings.filter((f) => f.rule === 'source/physical-css').map((f) => `${f.file}:${f.line}`)
  }
  const files = { 'a.css': sheet, 'B.tsx': script, 'C.vue': vue, 'D.svelte': `<p>x</p>\n<style>\n${sheet}\n</style>\n`, 'index.html': '<html dir="rtl"></html>' }

  it('postcss-rtlcss quiets stylesheets and component style blocks, not template CSS', async () => {
    expect(await physicalLines('postcss-rtlcss', files)).toEqual(['B.tsx:2', 'C.vue:7'])
  })

  it.each(['rtlcss', 'postcss-rtl', 'cssjanus'])('%s behaves like a PostCSS flipper', async (name) => {
    expect(await physicalLines(name, files)).toEqual(['B.tsx:2', 'C.vue:7'])
  })

  it.each(['stylis-plugin-rtl', '@mui/stylis-plugin-rtl'])('%s quiets template CSS, not stylesheets', async (name) => {
    expect(await physicalLines(name, files)).toEqual(['C.vue:3', 'D.svelte:3', 'a.css:1'])
  })
})
