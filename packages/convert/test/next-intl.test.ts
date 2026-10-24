import { parseSourceOutcome } from '@dualkit/lint'
import { describe, expect, it } from 'vitest'
import { applyEdits } from '../src/edits'
import { wireNextIntl } from '../src/generate/next-intl'
import { UnsupportedError } from '../src/project'
import type { Plan, Project } from '../src/types'
import { fixtureDir, projectFiles } from './helpers'

const project: Project = { root: '/r', framework: 'next-app', appDir: 'app', entry: 'app/layout.tsx', tailwind: 'v4', i18n: null, packageManager: 'npm' }
const fixture = projectFiles(fixtureDir('next-app'))

/** A files reader and path list over an in-memory project. */
function memory(map: Record<string, string>): { files: (rel: string) => string | null; paths: string[] } {
  return { files: (rel) => map[rel] ?? null, paths: Object.keys(map).sort() }
}

const pkg = (next: string): string => JSON.stringify({ dependencies: { next, react: '19.0.0' } })

/** Throws when generated code does not parse as TSX. */
function parses(path: string, text: string): void {
  const outcome = parseSourceOutcome(path, text)
  if (!('file' in outcome)) throw new Error(`${path}: ${outcome.error}`)
}

/** The text of a file after the plan: moved content with the plan's edits applied. */
function after(plan: Plan, files: (rel: string) => string | null, path: string): string {
  const from = plan.moves.find(([, to]) => to === path)?.[0] ?? path
  return applyEdits(files(from)!, plan.edits[path] ?? [])
}

const routeOf = (plan: Plan, from: string): string | undefined => plan.moves.find(([f]) => f === from)?.[1]

/** An app with a root not-found and global-error. */
const notFoundApp = (): Record<string, string> => ({
  'package.json': pkg('15.0.0'), 'app/layout.tsx': fixture.files('app/layout.tsx')!,
  'app/page.tsx': 'export default function P() { return null }\n',
  'app/not-found.tsx': 'export default function N() { return null }\n',
  'app/global-error.tsx': "'use client'\nexport default function E() { return null }\n",
})

/** The project files after a plan: moves, then writes, then edits. */
function applyPlan(map: Record<string, string>, plan: Plan): Record<string, string> {
  const out = { ...map }
  for (const [from, to] of plan.moves) { out[to] = out[from]!; delete out[from] }
  Object.assign(out, plan.writes)
  for (const [path, edits] of Object.entries(plan.edits)) out[path] = applyEdits(out[path]!, edits)
  return out
}

describe('wireNextIntl bilingual', () => {
  const plan = wireNextIntl(project, 'bilingual', fixture.files, fixture.paths)

  it('moves routes under [locale] and leaves api routes', () => {
    const big = memory({ 'package.json': pkg('15.1.0'), 'app/layout.tsx': fixture.files('app/layout.tsx')!, 'app/page.tsx': 'export default function P() { return null }\n', 'app/api/route.ts': 'export function GET() {}\n', 'app/favicon.ico': 'x', 'app/robots.ts': 'export default function r() {}\n', 'app/globals.css': '' })
    const moves = wireNextIntl(project, 'bilingual', big.files, big.paths).moves
    expect(moves).toContainEqual(['app/page.tsx', 'app/[locale]/page.tsx'])
    expect(moves).toContainEqual(['app/layout.tsx', 'app/[locale]/layout.tsx'])
    const from = moves.map(([f]) => f)
    for (const kept of ['app/api/route.ts', 'app/favicon.ico', 'app/robots.ts', 'app/globals.css']) expect(from).not.toContain(kept)
  })

  it('moves nested routes in the fixture', () => {
    expect(plan.moves).toContainEqual(['app/orders/[id]/page.tsx', 'app/[locale]/orders/[id]/page.tsx'])
  })

  it('writes routing with as-needed prefixes and English as default', () => {
    const routing = plan.writes['i18n/routing.ts']!
    expect(routing).toContain("locales: ['en', 'ar']")
    expect(routing).toContain("defaultLocale: 'en'")
    expect(routing).toContain("localePrefix: 'as-needed'")
    expect(routing).toContain("from 'next-intl/routing'")
  })

  it('writes request config that falls back to the default locale and loads root messages', () => {
    const request = plan.writes['i18n/request.ts']!
    expect(request).toContain('getRequestConfig')
    expect(request).toContain('hasLocale(routing.locales, requested)')
    expect(request).toContain('import(`../messages/${locale}.json`)')
  })

  it('writes middleware for Next 15 with a matcher that skips api, _next and files with a dot', () => {
    const middleware = plan.writes['middleware.ts']!
    expect(plan.writes['proxy.ts']).toBeUndefined()
    expect(middleware).toContain("import createMiddleware from 'next-intl/middleware'")
    expect(middleware).toContain('export default createMiddleware(routing)')
    expect(middleware).toContain("matcher: '/((?!(?:api|_next|_vercel)(?:/|$)|.*\\\\..*).*)'")
  })

  it('writes proxy.ts for Next 16 and puts files under src when the app dir is src/app', () => {
    const src = memory({ 'package.json': pkg('^16.0.1'), 'src/app/layout.tsx': fixture.files('app/layout.tsx')!, 'src/app/page.tsx': 'export default function P() { return null }\n' })
    const p = wireNextIntl({ ...project, appDir: 'src/app', entry: 'src/app/layout.tsx' }, 'bilingual', src.files, src.paths)
    expect(Object.keys(p.writes).sort()).toEqual([
      'next.config.mjs', 'src/app/[locale]/[...rest]/page.tsx', 'src/components/dualkit-language-switch.tsx', 'src/i18n/navigation.ts', 'src/i18n/request.ts',
      'src/i18n/routing.ts', 'src/lib/dualkit-locale.ts', 'src/proxy.ts',
    ])
    expect(p.writes['src/i18n/request.ts']).toContain('import(`../../messages/${locale}.json`)')
  })

  it('does not write messages, which the orchestrator writes from the ledger', () => {
    expect(Object.keys(plan.writes).some((p) => p.startsWith('messages/'))).toBe(false)
  })

  it('reads locale from params, sets lang and dir, and wraps the body in the provider', () => {
    const layout = after(plan, fixture.files, 'app/[locale]/layout.tsx')
    expect(layout).toContain('<html lang={locale} dir={locale === \'ar\' ? \'rtl\' : \'ltr\'}>')
    expect(layout).not.toContain('lang="en"')
    expect(layout).toContain('export default async function RootLayout({ params, children }: { children: ReactNode } & { params: Promise<{ locale: string }> })')
    expect(layout).toContain('const { locale } = await params')
    expect(layout).toContain('if (!hasLocale(routing.locales, locale)) notFound()')
    expect(layout).toContain('setRequestLocale(locale)')
    expect(layout).toMatch(/<body className="[^"]*"><NextIntlClientProvider>[\s\S]*<\/NextIntlClientProvider><\/body>/)
    expect(layout).toContain("import { NextIntlClientProvider, hasLocale } from 'next-intl'")
    expect(layout).toContain("import { setRequestLocale } from 'next-intl/server'")
    expect(layout).toContain("import { notFound } from 'next/navigation'")
    expect(layout).toContain("import { routing } from '../../i18n/routing'")
    expect(layout).toContain('export function generateStaticParams()')
    parses('app/[locale]/layout.tsx', layout)
  })

  it('rewrites relative imports that cross the move', () => {
    const layout = after(plan, fixture.files, 'app/[locale]/layout.tsx')
    expect(layout).toContain("import { Header } from '../../components/header'")
    expect(layout).toContain("import '../globals.css'")
  })

  it('rewrites imports into moved files from files that stay', () => {
    const m = memory({
      'package.json': pkg('15.0.0'), 'app/layout.tsx': fixture.files('app/layout.tsx')!,
      'app/page.tsx': "import { a } from './util'\nexport default function P() { return a }\n",
      'app/util.ts': 'export const a = 1\n',
      'app/api/route.ts': "import { a } from '../util'\nexport function GET() { return a }\n",
    })
    const p = wireNextIntl(project, 'bilingual', m.files, m.paths)
    expect(p.edits['app/[locale]/page.tsx'] ?? []).toEqual([])
    expect(after(p, m.files, 'app/api/route.ts')).toContain("from '../[locale]/util'")
  })

  it('reads the locale from next/root-params on Next 16.3 and later, so cache components can prerender', () => {
    const request = (next: string, installed?: string): string => {
      const m = memory({
        'package.json': pkg(next), 'app/layout.tsx': fixture.files('app/layout.tsx')!,
        ...(installed ? { 'node_modules/next/package.json': JSON.stringify({ version: installed }) } : {}),
      })
      return wireNextIntl(project, 'bilingual', m.files, m.paths.filter((p) => !p.startsWith('node_modules/'))).writes['i18n/request.ts']!
    }
    expect(request('16.4.3')).toContain("import * as rootParams from 'next/root-params'")
    expect(request('16.4.3')).toContain('await rootParams.locale()')
    expect(request('16.4.3')).toContain('import(`../messages/${locale}.json`)')
    expect(request('^16.0.0', '16.3.1')).toContain('rootParams.locale()')
    expect(request('16.2.0')).toContain('await requestLocale')
    expect(request('15.1.0')).not.toContain('root-params')
    parses('i18n/request.ts', request('16.4.3'))
  })

  it('moves the route in typed LayoutProps and PageProps under [locale]', () => {
    const layoutText = 'export default function RootLayout({ children }: LayoutProps<"/">) {\n  return <html><body>{children}</body></html>\n}\n'
    const m = memory({
      'package.json': pkg('16.0.0'), 'app/layout.tsx': layoutText,
      'app/pricing/page.tsx': "export default function P(props: PageProps<'/pricing'>) { return null }\n",
    })
    const p = wireNextIntl(project, 'bilingual', m.files, m.paths)
    const layout = after(p, m.files, 'app/[locale]/layout.tsx')
    expect(layout).toContain('LayoutProps<"/[locale]">')
    parses('app/[locale]/layout.tsx', layout)
    expect(after(p, m.files, 'app/[locale]/pricing/page.tsx')).toContain("PageProps<'/[locale]/pricing'>")
  })

  it('takes a plain params type on Next 14', () => {
    const m = memory({ 'package.json': pkg('14.2.3'), 'app/layout.tsx': fixture.files('app/layout.tsx')! })
    const layout = after(wireNextIntl(project, 'bilingual', m.files, m.paths), m.files, 'app/[locale]/layout.tsx')
    expect(layout).toContain('& { params: { locale: string } }')
  })

  it('moves not-found under [locale], keeps global-error at the root and adds the catch-all', () => {
    const m = memory(notFoundApp())
    const p = wireNextIntl(project, 'bilingual', m.files, m.paths)
    expect(p.moves).toContainEqual(['app/not-found.tsx', 'app/[locale]/not-found.tsx'])
    expect(p.moves.map(([f]) => f)).not.toContain('app/global-error.tsx')
    expect(p.writes['app/layout.tsx']).toBeUndefined()
    const rest = p.writes['app/[locale]/[...rest]/page.tsx']!
    expect(rest).toContain("import { notFound } from 'next/navigation'")
    expect(rest).toContain('notFound()')
    parses('app/[locale]/[...rest]/page.tsx', rest)
    expect(p.flags).toEqual([])
  })

  it('flags an existing top-level catch-all instead of adding one', () => {
    const m = memory({ ...notFoundApp(), 'app/(site)/[...slug]/page.tsx': 'export default function P() { return null }\n' })
    const p = wireNextIntl(project, 'bilingual', m.files, m.paths)
    expect(Object.keys(p.writes).some((w) => w.includes('[...rest]'))).toBe(false)
    expect(p.flags.map((f) => [f.kind, f.file])).toEqual([['unsupported', 'app/[locale]/(site)/[...slug]/page.tsx']])
  })

  it('returns an empty plan with one info flag once the app is wired, under app and src/app', () => {
    for (const appDir of ['app', 'src/app']) {
      const map = Object.fromEntries(Object.entries(notFoundApp()).map(([k, v]) => [k.replace(/^app\//, `${appDir}/`), v]))
      const first = { ...project, appDir, entry: `${appDir}/layout.tsx` }
      const wired = applyPlan(map, wireNextIntl(first, 'bilingual', memory(map).files, memory(map).paths))
      const m = memory(wired)
      const again = wireNextIntl({ ...first, entry: `${appDir}/[locale]/layout.tsx` }, 'bilingual', m.files, m.paths)
      expect(again).toMatchObject({ moves: [], writes: {}, edits: {}, deps: {} })
      expect(again.flags.map((f) => f.kind)).toEqual(['info'])
    }
  })

  it('anchors the kept segments: apiary moves, a page under api stays and is flagged', () => {
    const m = memory({ 'package.json': pkg('15.0.0'), 'app/layout.tsx': fixture.files('app/layout.tsx')!, 'app/apiary/page.tsx': 'export default function P() { return null }\n', 'app/api/page.tsx': 'export default function P() { return null }\n', 'app/feed.xml/route.ts': 'export function GET() {}\n', 'app/docs/[...slug]/page.tsx': 'export default function P() { return null }\n' })
    const p = wireNextIntl(project, 'bilingual', m.files, m.paths)
    expect(p.moves).toContainEqual(['app/apiary/page.tsx', 'app/[locale]/apiary/page.tsx'])
    expect(p.moves.map(([f]) => f)).not.toContain('app/api/page.tsx')
    expect(p.moves.map(([f]) => f)).not.toContain('app/feed.xml/route.ts')
    expect(routeOf(p, 'app/docs/[...slug]/page.tsx')).toBe('app/[locale]/docs/[...slug]/page.tsx')
    expect(p.flags.map((f) => [f.kind, f.file])).toEqual([['unsupported', 'app/api/page.tsx']])
  })

  it('rewrites alias imports into the app dir and keeps their alias form, with ./* paths', () => {
    const m = memory({
      'package.json': pkg('15.0.0'), 'app/layout.tsx': fixture.files('app/layout.tsx')!,
      'tsconfig.json': '{\n  // aliases\n  "$schema": "https://json.schemastore.org/tsconfig",\n  "compilerOptions": { "paths": { "@/*": ["./*"] }, },\n}\n',
      'app/ui/button.tsx': 'export const Button = 1\n',
      'components/card.tsx': "import { Button } from '@/app/ui/button'\nimport { Gone } from '@/app/ui/missing'\nimport { Other } from '@/components/other'\nexport const Card = [Button, Gone, Other]\n",
      'components/other.tsx': 'export const Other = 1\n',
    })
    const p = wireNextIntl(project, 'bilingual', m.files, m.paths)
    const card = after(p, m.files, 'components/card.tsx')
    expect(card).toContain("from '@/app/[locale]/ui/button'")
    expect(card).toContain("from '@/app/ui/missing'")
    expect(card).toContain("from '@/components/other'")
  })

  it('rewrites alias imports with ./src/* paths when the app dir is src/app', () => {
    const m = memory({
      'package.json': pkg('15.0.0'), 'src/app/layout.tsx': fixture.files('app/layout.tsx')!,
      'tsconfig.json': JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } }),
      'src/app/ui/button.tsx': 'export const Button = 1\n',
      'src/components/card.tsx': "import { Button } from '@/app/ui/button'\nexport const Card = Button\n",
    })
    const p = wireNextIntl({ ...project, appDir: 'src/app', entry: 'src/app/layout.tsx' }, 'bilingual', m.files, m.paths)
    expect(after(p, m.files, 'src/components/card.tsx')).toContain("from '@/app/[locale]/ui/button'")
  })

  it('writes the language switch with next-intl navigation', () => {
    const nav = plan.writes['i18n/navigation.ts']!
    expect(nav).toContain('createNavigation(routing)')
    const sw = plan.writes['components/dualkit-language-switch.tsx']!
    expect(sw).toContain("'use client'")
    expect(sw).toContain("from '../i18n/navigation'")
    expect(sw).toContain('English')
    expect(sw).toContain('العربية')
    expect(sw).not.toContain('—')
    parses('components/dualkit-language-switch.tsx', sw)
  })

  it('writes the locale helper', () => {
    const helper = plan.writes['lib/dualkit-locale.ts']!
    expect(helper).toContain('export function dkIntlLocale(locale: string): string')
    expect(helper).toContain("'ar-AE-u-nu-latn'")
  })

  it('writes next.config.mjs when there is none, and wraps an existing one', () => {
    expect(plan.writes['next.config.mjs']).toContain('withNextIntl(')
    const esm = "import type { NextConfig } from 'next'\n\nconst nextConfig: NextConfig = { reactStrictMode: true }\n\nexport default nextConfig\n"
    const m = memory({ 'package.json': pkg('15.0.0'), 'app/layout.tsx': fixture.files('app/layout.tsx')!, 'next.config.ts': esm })
    const p = wireNextIntl(project, 'bilingual', m.files, m.paths)
    const config = after(p, m.files, 'next.config.ts')
    expect(config).toContain("import createNextIntlPlugin from 'next-intl/plugin'")
    expect(config).toContain('const withNextIntl = createNextIntlPlugin()')
    expect(config).toContain('export default withNextIntl(nextConfig)')
    parses('next.config.ts', config)
    const cjs = "/** @type {import('next').NextConfig} */\nmodule.exports = { reactStrictMode: true };\n"
    const c = memory({ 'package.json': pkg('15.0.0'), 'app/layout.tsx': fixture.files('app/layout.tsx')!, 'next.config.js': cjs })
    const out = after(wireNextIntl(project, 'bilingual', c.files, c.paths), c.files, 'next.config.js')
    expect(out).toContain("const createNextIntlPlugin = require('next-intl/plugin');")
    expect(out).toContain('module.exports = withNextIntl({ reactStrictMode: true });')
  })

  it('pins next-intl', () => {
    expect(plan.deps).toEqual({ 'next-intl': '4.14.9' })
  })

  it('writes code that parses', () => {
    for (const [path, text] of Object.entries(plan.writes)) parses(path, text)
  })

  it('refuses an app that already has its own middleware', () => {
    const m = memory({ 'package.json': pkg('15.0.0'), 'app/layout.tsx': fixture.files('app/layout.tsx')!, 'middleware.ts': 'export function middleware() {}\n' })
    expect(() => wireNextIntl(project, 'bilingual', m.files, m.paths)).toThrow(UnsupportedError)
  })
})

describe('wireNextIntl arabic', () => {
  const plan = wireNextIntl(project, 'arabic', fixture.files, fixture.paths)

  it('has no moves, no middleware and no switch', () => {
    expect(plan.moves).toEqual([])
    expect(Object.keys(plan.writes).sort()).toEqual(['i18n/request.ts', 'lib/dualkit-locale.ts', 'next.config.mjs'])
  })

  it('fixes the request locale to ar and loads only Arabic messages', () => {
    const request = plan.writes['i18n/request.ts']!
    expect(request).toContain("locale: 'ar'")
    expect(request).toContain("import('../messages/ar.json')")
    expect(request).not.toContain('en.json')
  })

  it('sets lang and dir on html in the layout edit and adds the provider', () => {
    const layout = after(plan, fixture.files, 'app/layout.tsx')
    expect(layout).toContain('<html lang="ar" dir="rtl">')
    expect(layout).toContain('<NextIntlClientProvider>')
    expect(layout).not.toContain('params')
    parses('app/layout.tsx', layout)
  })
})
