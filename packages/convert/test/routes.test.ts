import { cpSync, mkdirSync, mkdtempSync, renameSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { listRoutes } from '../src/routes'
import type { Project } from '../src/types'

const fixture = (name: string): string => resolve(__dirname, 'fixtures', name)
const nextProject = (root: string, appDir = 'app'): Project => ({
  root, framework: 'next-app', appDir, entry: `${appDir}/layout.tsx`, tailwind: null, i18n: null, packageManager: 'npm',
})
const copy = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'dualkit-routes-'))
  cpSync(fixture('next-app'), dir, { recursive: true })
  return dir
}
const touch = (dir: string, file: string): void => {
  mkdirSync(join(dir, file, '..'), { recursive: true })
  writeFileSync(join(dir, file), 'export default function P() { return null }\n')
}
const NEEDS = 'needs sample params in dualkit.config.json'

describe('listRoutes', () => {
  it('lists the Next fixture and puts the dynamic route in unreachable', () => {
    const result = listRoutes(nextProject(fixture('next-app')), {})
    expect(result.routes).toEqual(['/', '/pricing', '/settings'])
    expect(result.unreachable).toEqual([{ route: '/orders/[id]', reason: NEEDS }])
  })

  it('uses config.params for a dynamic route', () => {
    const result = listRoutes(nextProject(fixture('next-app')), { params: { '/orders/[id]': '/orders/42' } })
    expect(result.routes).toEqual(['/', '/orders/42', '/pricing', '/settings'])
    expect(result.unreachable).toEqual([])
  })

  it('lists the same routes after pages move under app/[locale]', () => {
    const before = listRoutes(nextProject(fixture('next-app')), {})
    const dir = copy()
    mkdirSync(join(dir, 'app/[locale]'))
    for (const name of ['page.tsx', 'orders', 'pricing', 'settings']) renameSync(join(dir, 'app', name), join(dir, 'app/[locale]', name))
    touch(dir, 'app/[locale]/[...rest]/page.tsx')
    expect(listRoutes(nextProject(dir), {})).toEqual(before)
  })

  it('removes route groups and sends catch-alls to unreachable unless mapped', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dualkit-routes-'))
    touch(dir, 'app/(marketing)/about/page.tsx')
    touch(dir, 'app/docs/[...slug]/page.tsx')
    touch(dir, 'app/shop/[[...parts]]/page.js')
    const project = nextProject(dir)
    const plain = listRoutes(project, {})
    expect(plain.routes).toEqual(['/about'])
    expect(plain.unreachable.map((u) => u.route)).toEqual(['/docs/[...slug]', '/shop/[[...parts]]'])
    const mapped = listRoutes(project, { params: { '/docs/[...slug]': '/docs/a/b' } })
    expect(mapped.routes).toEqual(['/about', '/docs/a/b'])
  })

  it('reads src/app and skips parallel and intercepting folders', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dualkit-routes-'))
    touch(dir, 'src/app/page.tsx')
    touch(dir, 'src/app/@modal/login/page.tsx')
    touch(dir, 'src/app/feed/(.)photo/page.tsx')
    touch(dir, 'src/app/feed/page.tsx')
    expect(listRoutes(nextProject(dir, 'src/app'), {}).routes).toEqual(['/', '/feed'])
  })

  it('uses config.routes for Vite, defaulting to /', () => {
    const project: Project = { ...nextProject('/x'), framework: 'vite-react', appDir: null, entry: 'src/main.tsx' }
    expect(listRoutes(project, {})).toEqual({ routes: ['/'], unreachable: [] })
    expect(listRoutes(project, { routes: ['/', '/about'] }).routes).toEqual(['/', '/about'])
  })
})
