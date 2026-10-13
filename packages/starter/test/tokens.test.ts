import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { build, flatten, readResolver, resolveContext, resolveValue, toCss, toFigma, toTailwind } from '../scripts/tokens.mjs'

const PKG = join(import.meta.dirname, '..')
const RESOLVER = join(PKG, 'tokens/dualkit.resolver.json')
const resolver = readResolver(RESOLVER)
const css = toCss(resolver)
const theme = toTailwind(resolver)
const figma = toFigma(resolver)
const en = resolveContext(resolver, { theme: 'light', script: 'en' })
const ar = resolveContext(resolver, { theme: 'light', script: 'ar' })
const block = (selector: string) => {
  const start = css.indexOf(`${selector} {`)
  expect(start, `${selector} block`).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf('}', start))
}

describe('flatten', () => {
  it('inherits $type and $extensions from the nearest group', () => {
    const tokens = flatten({ a: { $type: 'number', $extensions: { 'dev.dualkit': { unit: 'em' } }, b: { $value: 1 } } })
    expect(tokens.get('a.b')).toMatchObject({ path: 'a.b', type: 'number', value: 1, unit: 'em' })
  })

  it('refuses a token with no type', () => {
    expect(() => flatten({ a: { $value: 1 } })).toThrow(/a has no \$type/)
  })
})

describe('resolveValue', () => {
  const map = flatten({ n: { $type: 'number', a: { $value: 1 }, b: { $value: '{n.a}' }, c: { $value: '{n.d}' }, d: { $value: '{n.c}' }, e: { $value: '{n.zz}' } } })

  it('follows aliases to the raw value', () => {
    expect(resolveValue(map, 'n.b')).toBe(1)
  })

  it('names a cycle', () => {
    expect(() => resolveValue(map, 'n.c')).toThrow(/cycle: n.c -> n.d -> n.c/)
  })

  it('names a missing target', () => {
    expect(() => resolveValue(map, 'n.e')).toThrow(/n.e points at n.zz, which does not exist/)
  })
})

describe('resolveContext', () => {
  it('lets dark override the semantic colours only', () => {
    const dark = resolveContext(resolver, { theme: 'dark', script: 'en' })
    expect(dark.get('color.surface.ground')?.value).toBe('{color.neutral.950}')
    expect(dark.get('color.neutral.50')?.value).toEqual(en.get('color.neutral.50')?.value)
  })

  it('swaps every type role to the Arabic face', () => {
    const roles = [...ar.keys()].filter((k) => k.startsWith('type.') && k.endsWith('.family'))
    expect(roles.length).toBeGreaterThanOrEqual(6)
    for (const role of roles) expect(ar.get(role)?.value).toBe('{font.family.arabic}')
  })

  it('refuses a context the resolver does not have', () => {
    expect(() => resolveContext(resolver, { theme: 'sepia', script: 'en' })).toThrow(/theme has no context sepia/)
  })
})

describe('the Arabic type rules from dualkit-type-pairing', () => {
  const roles = [...new Set([...ar.keys()].filter((k) => k.startsWith('type.')).map((k) => k.split('.')[1]))]
  const value = (map: typeof ar, path: string) => resolveValue(map, path) as { value: number } | number

  it.each(roles)('%s has no tracking, at least 14px and more leading than English', (role) => {
    expect(value(ar, `type.${role}.tracking`)).toBe(0)
    expect((value(ar, `type.${role}.size`) as { value: number }).value).toBeGreaterThanOrEqual(14)
    expect(value(ar, `type.${role}.leading`) as number).toBeGreaterThan(value(en, `type.${role}.leading`) as number)
  })

  it('sets Arabic body text at 16px or more with leading of 1.6 or more', () => {
    expect((value(ar, 'type.body.size') as { value: number }).value).toBeGreaterThanOrEqual(16)
    expect(value(ar, 'type.body.leading') as number).toBeGreaterThanOrEqual(1.6)
  })
})

describe('toCss', () => {
  it('writes primitives as values and semantic tokens as references', () => {
    const root = block(':root')
    expect(root).toContain('--dk-color-neutral-50: #fafafa;')
    expect(root).toContain('--dk-color-alpha-black-8: rgb(0 0 0 / 0.08);')
    expect(root).toContain('--dk-color-surface-ground: var(--dk-color-neutral-50);')
    expect(root).toContain("--dk-font-family-arabic: 'IBM Plex Sans Arabic', 'Geeza Pro', 'Noto Sans Arabic', sans-serif;")
    expect(root).toContain('--dk-font-tracking-tighter: -0.03em;')
    expect(root).toContain('--dk-motion-duration-fast: 120ms;')
    expect(root).toContain('--dk-motion-easing-standard: cubic-bezier(0.2, 0, 0, 1);')
    expect(root).toContain('--dk-type-body-family: var(--dk-font-family-latin);')
  })

  it('writes every token of the default context', () => {
    for (const path of en.keys()) expect(block(':root')).toContain(`--dk-${path.replaceAll('.', '-').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}:`)
  })

  it('writes dark for the system setting and for an explicit choice, with the same body', () => {
    const system = block(`@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"])`)
    const chosen = block(':root[data-theme="dark"]')
    expect(chosen).toContain('--dk-color-surface-ground: var(--dk-color-neutral-950);')
    const body = (b: string) => b.split('{').pop()!.replace(/\s+/g, ' ').trim()
    expect(body(system)).toBe(body(chosen))
    expect(chosen).not.toMatch(/^\s*--dk-color-neutral-/m)
  })

  it('switches type by language, not direction', () => {
    const arabic = block(':lang(ar)')
    expect(arabic).toContain('--dk-type-body-family: var(--dk-font-family-arabic);')
    expect(arabic).toContain('--dk-type-heading-tracking: var(--dk-font-tracking-none);')
    expect(arabic).not.toContain('--dk-color-')
  })

  it('gives an English island inside Arabic its English type back', () => {
    const island = block(':lang(ar) :not(:lang(ar))')
    expect(island).toContain('--dk-type-body-family: var(--dk-font-family-latin);')
    expect(island).toContain('--dk-type-display-tracking: var(--dk-font-tracking-tighter);')
    expect(css.indexOf(':lang(ar) :not(:lang(ar))')).toBeGreaterThan(css.indexOf(':lang(ar) {'))
  })
})

describe('toTailwind', () => {
  it('maps semantic tokens into Tailwind v4 namespaces by reference', () => {
    expect(theme).toContain('@theme inline {')
    expect(theme).toContain('--color-surface-ground: var(--dk-color-surface-ground);')
    expect(theme).toContain('--color-text-secondary: var(--dk-color-text-secondary);')
    expect(theme).toContain('--radius-control: var(--dk-radius-control);')
    expect(theme).toContain('--spacing-inset-control: var(--dk-space-inset-control);')
    expect(theme).toContain('--font-body: var(--dk-type-body-family);')
    expect(theme).toContain('--text-body: var(--dk-type-body-size);')
    expect(theme).toContain('--text-body--line-height: var(--dk-type-body-leading);')
    expect(theme).toContain('--text-body--letter-spacing: var(--dk-type-body-tracking);')
    expect(theme).toContain('--text-body--font-weight: var(--dk-type-body-weight);')
    expect(theme).toContain('--ease-standard: var(--dk-motion-easing-standard);')
  })

  it('never exposes primitives, so components bind semantic tokens only', () => {
    expect(theme).not.toMatch(/--dk-color-neutral-|--dk-font-size-|--dk-space-\d/)
  })
})

describe('toFigma', () => {
  const collection = (name: string) => figma.collections.find((c: { name: string }) => c.name === name)!
  const variable = (c: string, name: string) => collection(c).variables.find((v: { name: string }) => v.name === name)

  it('makes Primitives, Semantic and Script with the mode names figma-render uses', () => {
    expect(figma.collections.map((c: { name: string; modes: string[] }) => [c.name, c.modes])).toEqual([
      ['Primitives', ['Value']],
      ['Semantic', ['Light', 'Dark']],
      ['Script', ['en', 'ar']],
    ])
  })

  it('writes primitive colours as Figma RGBA', () => {
    expect(variable('Primitives', 'color/alpha/black/8')).toEqual({
      name: 'color/alpha/black/8', type: 'COLOR', description: '', valuesByMode: { Value: { r: 0, g: 0, b: 0, a: 0.08 } },
    })
  })

  it('aliases semantic and script variables per mode', () => {
    expect(variable('Semantic', 'color/surface/ground').valuesByMode).toEqual({
      Light: { type: 'VARIABLE_ALIAS', collection: 'Primitives', name: 'color/neutral/50' },
      Dark: { type: 'VARIABLE_ALIAS', collection: 'Primitives', name: 'color/neutral/950' },
    })
    expect(variable('Script', 'type/body/family').valuesByMode.ar).toEqual({ type: 'VARIABLE_ALIAS', collection: 'Primitives', name: 'font/family/arabic' })
  })

  it('converts units Figma can hold and lists the ones it cannot', () => {
    expect(variable('Primitives', 'font/family/latin').valuesByMode.Value).toBe('Switzer')
    expect(variable('Primitives', 'space/4').valuesByMode.Value).toBe(16)
    expect(variable('Primitives', 'font/tracking/tighter')).toMatchObject({ type: 'FLOAT', valuesByMode: { Value: -3 } })
    expect(variable('Semantic', 'motion/duration/fast').valuesByMode.Light).toBe(120)
    expect(figma.skipped).toEqual(['motion.easing.out', 'motion.easing.standard'])
  })
})

describe('the generated files', () => {
  it('match a fresh build of the token source, so a stale commit fails', () => {
    for (const [name, content] of Object.entries(build(RESOLVER))) {
      expect(readFileSync(join(PKG, 'generated', name), 'utf8'), `generated/${name} is stale: run npm run build -w @dualkit/starter`).toBe(content)
    }
  })
})
