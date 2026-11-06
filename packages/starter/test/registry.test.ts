import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error plain .mjs build script
import { ITEMS, OUT_DIR, buildRegistry } from '../scripts/registry.mjs'

type Item = { name: string; files: { path: string; target: string }[]; registryDependencies?: string[]; dependencies?: string[] }
const built: Map<string, string> = buildRegistry()
const STARTER_ITEMS = (ITEMS as Item[]).filter((i) => !i.name.startsWith('gulf-'))

describe('shadcn registry', () => {
  it('matches the files served from dualkit.dev/r/', () => {
    expect(readdirSync(OUT_DIR).sort()).toEqual([...built.keys()].sort())
    for (const [name, text] of built) expect(readFileSync(join(OUT_DIR, name), 'utf8'), name).toBe(text)
  })

  it('ships every component the Starter exports', () => {
    const index = readFileSync(join(__dirname, '../components/index.ts'), 'utf8')
    const shipped = new Set((ITEMS as Item[]).flatMap((i) => i.files.map((f) => f.path)))
    for (const [, source] of index.matchAll(/from '\.\/(\w+)'/g)) {
      expect(shipped.has(`components/${source}.tsx`) || shipped.has(`components/${source}.ts`), source).toBe(true)
    }
  })

  it('points every source path at a real file', () => {
    for (const item of ITEMS as Item[]) for (const f of item.files) expect(existsSync(join(__dirname, '..', f.path)), f.path).toBe(true)
  })

  it('keeps the index free of file contents, as the directory requires', () => {
    expect(built.get('registry.json')).not.toContain('"content"')
  })

  it('installs every component into one folder so relative imports keep working', () => {
    for (const item of STARTER_ITEMS) for (const f of item.files) expect(f.target.startsWith('components/dualkit/')).toBe(true)
  })
})

describe('gulf registry items', () => {
  const GULF = ['gulf-field', 'gulf-phone-input', 'gulf-iban-input', 'gulf-national-id-input', 'gulf-amount', 'gulf-hijri-date']
  const gulf = (ITEMS as Item[]).filter((i) => i.name.startsWith('gulf-'))
  const source = (item: Item) => item.files.map((f) => readFileSync(join(__dirname, '..', f.path), 'utf8')).join('\n')

  it('ships the gulf set after the nine starter items, which stay as they were', () => {
    expect((ITEMS as Item[]).map((i) => i.name)).toEqual([
      'base', 'amount', 'button', 'date-display', 'digit-input', 'field', 'sheet', 'tabs', 'toast', ...GULF,
    ])
  })

  it('lists every gulf item in registry.json and writes its own file', () => {
    const index = JSON.parse(built.get('registry.json')!) as { items: Item[] }
    for (const name of GULF) {
      expect(index.items.some((i) => i.name === name), name).toBe(true)
      expect(built.has(`${name}.json`), name).toBe(true)
    }
  })

  it('builds on shadcn primitives and format, never on the Dualkit base', () => {
    for (const item of gulf) {
      expect(item.registryDependencies, item.name).toContain('label')
      expect(item.registryDependencies, item.name).not.toContain('https://dualkit.dev/r/base.json')
      if (item.name !== 'gulf-field') {
        expect(item.registryDependencies, item.name).toContain('input')
        expect(item.registryDependencies, item.name).toContain('https://dualkit.dev/r/gulf-field.json')
        expect(item.dependencies, item.name).toEqual(['@dualkit/format'])
      }
    }
  })

  it('installs into components/gulf so the shared field resolves', () => {
    for (const item of gulf) for (const f of item.files) expect(f.target).toMatch(/^components\/gulf\/gulf-[\w-]+\.tsx$/)
  })

  it('uses only shadcn variables and logical classes', () => {
    const PHYSICAL = /(?<![\w-])(?:-?m[lr]-|p[lr]-|left-|right-|text-left|text-right|rounded-[lr]-|border-[lr]-|float-(?:left|right))/
    for (const item of gulf) {
      const text = source(item)
      expect(text, item.name).not.toMatch(/--dk-|\bdk-/)
      for (const [literal] of text.matchAll(/(["'`])[^"'`\n]*\1/g)) expect(literal, item.name).not.toMatch(PHYSICAL)
    }
  })

  it('carries no Arabic copy of its own', () => {
    for (const item of gulf) expect(source(item), item.name).not.toMatch(/[\u0600-\u06FF]/)
  })

  it('imports only format, React, shadcn primitives and its sibling field', () => {
    for (const item of gulf) {
      for (const [, from] of source(item).matchAll(/from '([^']+)'/g)) {
        expect(['@dualkit/format', 'react', '@/components/ui/input', '@/components/ui/label', './gulf-field'], `${item.name}: ${from}`).toContain(from)
      }
    }
  })
})
