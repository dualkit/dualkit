import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createTailwindVersion, tailwindVersion } from '../src/tailwind-version'
import { tree } from './helpers'

const pkg = (deps: Record<string, unknown>, key = 'devDependencies'): string => JSON.stringify({ name: 'x', [key]: deps })
const installed = (version: string): string => JSON.stringify({ name: 'tailwindcss', version })

describe('tailwindVersion', () => {
  it('prefers the installed version over the range', () => {
    const root = tree({ 'package.json': pkg({ tailwindcss: '^3.3.0' }), 'node_modules/tailwindcss/package.json': installed('3.4.17'), 'src/a.tsx': '' })
    expect(tailwindVersion(join(root, 'src/a.tsx'), root)).toBe('3.4.17')
  })

  it('falls back to the lowest version the range allows', () => {
    const root = tree({ 'package.json': pkg({ tailwindcss: '^3.4.1' }), 'a.tsx': '' })
    expect(tailwindVersion(join(root, 'a.tsx'), root)).toBe('3.4.1')
  })

  it('reads dependencies and peerDependencies too', () => {
    for (const key of ['dependencies', 'peerDependencies']) {
      const root = tree({ 'package.json': pkg({ tailwindcss: '~4.2.0' }, key), 'a.tsx': '' })
      expect(tailwindVersion(join(root, 'a.tsx'), root), key).toBe('4.2.0')
    }
  })

  it('gives null without tailwind', () => {
    const root = tree({ 'package.json': pkg({ react: '^19.0.0' }), 'a.tsx': '' })
    expect(tailwindVersion(join(root, 'a.tsx'), root)).toBeNull()
    const bare = tree({ 'a.tsx': '' })
    expect(tailwindVersion(join(bare, 'a.tsx'), bare)).toBeNull()
  })

  it('gives each monorepo app its own version and finds a hoisted install', () => {
    const root = tree({
      'package.json': pkg({ typescript: '^5.0.0' }),
      'node_modules/tailwindcss/package.json': installed('3.4.3'),
      'apps/web/package.json': pkg({ tailwindcss: '^3.4.0' }),
      'apps/web/src/a.tsx': '',
      'apps/old/package.json': pkg({ tailwindcss: '3.2.7' }),
      'apps/old/node_modules/tailwindcss/package.json': installed('3.2.7'),
      'apps/old/a.tsx': '',
      'apps/next/package.json': pkg({ tailwindcss: '^4.2.1' }),
      'apps/next/node_modules/tailwindcss/package.json': installed('4.3.3'),
      'apps/next/a.tsx': '',
    })
    const resolve = createTailwindVersion()
    expect(resolve(join(root, 'apps/web/src/a.tsx'), root)).toBe('3.4.3')
    expect(resolve(join(root, 'apps/old/a.tsx'), root)).toBe('3.2.7')
    expect(resolve(join(root, 'apps/next/a.tsx'), root)).toBe('4.3.3')
  })

  it('gives null for malformed JSON, a bad range or a workspace range', () => {
    for (const body of ['{ nope', pkg({ tailwindcss: 'not a range' }), pkg({ tailwindcss: 'workspace:*' })]) {
      const root = tree({ 'package.json': body, 'a.tsx': '' })
      expect(tailwindVersion(join(root, 'a.tsx'), root), body).toBeNull()
    }
  })

  it('ignores an installed package with a bad version and uses the range', () => {
    const root = tree({ 'package.json': pkg({ tailwindcss: '^3.3.2' }), 'node_modules/tailwindcss/package.json': '{ bad', 'a.tsx': '' })
    expect(tailwindVersion(join(root, 'a.tsx'), root)).toBe('3.3.2')
  })

  it('walks up past cwd to a tailwind declared at the repo root', () => {
    const root = tree({ '.git/HEAD': '', 'package.json': pkg({ tailwindcss: '^3.4.1' }), 'apps/web/package.json': pkg({ react: '^19.0.0' }), 'apps/web/a.tsx': '' })
    expect(createTailwindVersion()(join(root, 'apps/web/a.tsx'), join(root, 'apps/web'))).toBe('3.4.1')
  })

  it('stops at a folder holding .git', () => {
    const outer = tree({ 'package.json': pkg({ tailwindcss: '^3.4.0' }), 'node_modules/tailwindcss/package.json': installed('3.4.9'), 'inner/.git': 'gitdir: x', 'inner/a.tsx': '' })
    expect(tailwindVersion(join(outer, 'inner/a.tsx'), join(outer, 'inner'))).toBeNull()
  })

  it('uses the installed copy only when it satisfies the range', () => {
    const stale = tree({ 'package.json': pkg({ tailwindcss: '^4.2.0' }), 'node_modules/tailwindcss/package.json': installed('3.4.17'), 'a.tsx': '' })
    expect(tailwindVersion(join(stale, 'a.tsx'), stale)).toBe('4.2.0')
    for (const range of ['workspace:*', 'catalog:', '*', 'latest']) {
      const root = tree({ 'package.json': pkg({ tailwindcss: range }), 'node_modules/tailwindcss/package.json': installed('4.1.0'), 'a.tsx': '' })
      expect(tailwindVersion(join(root, 'a.tsx'), root), range).toBe('4.1.0')
    }
  })
})
