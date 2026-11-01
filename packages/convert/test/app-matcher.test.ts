import { describe, expect, it } from 'vitest'
import { wireNextIntl } from '../src/generate/next-intl'
import type { Project } from '../src/types'

const project: Project = { root: '/r', framework: 'next-app', appDir: 'app', entry: 'app/layout.tsx', tailwind: 'v4', i18n: null, packageManager: 'npm' }

/** Loads the generated matcher source as a real function. */
function load(): (pathname: string, matcher: string | string[] | undefined) => boolean {
  const map: Record<string, string> = {
    'package.json': JSON.stringify({ dependencies: { next: '15.0.0' } }),
    'app/layout.tsx': 'export default function L({ children }: { children: React.ReactNode }) { return <html><body>{children}</body></html> }\n',
    'middleware.ts': 'export function middleware() {}\n',
  }
  const text = wireNextIntl(project, 'bilingual', (r) => map[r] ?? null, Object.keys(map)).writes['i18n/app-matcher.ts']!
  const js = text.replace(/: (string \| string\[\] \| undefined|string|RegExp|boolean)/g, '').replace(/\)!/g, ')').replace(/\[1\]!/g, '[1]').replace(/pattern\[i\]!/g, 'pattern[i]')
  return new Function(`${js.replace('export function', 'function')}; return matchesApp`)() as never
}

describe('generated app matcher', () => {
  const matches = load()

  it('treats a missing matcher as every path', () => {
    expect(matches('/anything', undefined)).toBe(true)
  })

  it('handles :path* and exact paths', () => {
    const m = ['/dashboard/:path*', '/login']
    expect(matches('/dashboard', m)).toBe(true)
    expect(matches('/dashboard/a/b', m)).toBe(true)
    expect(matches('/login', m)).toBe(true)
    expect(matches('/', m)).toBe(false)
    expect(matches('/dashboardx', m)).toBe(false)
  })

  it('handles a negative lookahead group', () => {
    const m = '/((?!api|_next/static|favicon.ico).*)'
    expect(matches('/pricing', m)).toBe(true)
    expect(matches('/api/x', m)).toBe(false)
    expect(matches('/_next/static/a.js', m)).toBe(false)
  })

  it('handles regex groups after a literal slash', () => {
    expect(matches('/trpc/a', '/(api|trpc)(.*)')).toBe(true)
    expect(matches('/other', '/(api|trpc)(.*)')).toBe(false)
  })
})
