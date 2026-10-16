import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error plain .mjs build script
import { ITEMS, OUT_DIR, buildRegistry } from '../scripts/registry.mjs'

type Item = { name: string; files: { path: string; target: string }[]; registryDependencies?: string[] }
const built: Map<string, string> = buildRegistry()

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
    for (const item of ITEMS as Item[]) for (const f of item.files) expect(f.target.startsWith('components/dualkit/')).toBe(true)
  })
})
