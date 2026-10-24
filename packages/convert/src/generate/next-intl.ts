import { posix } from 'node:path'
import { UnsupportedError } from '../project'
import { specifierTo } from '../transforms/imports'
import type { Edit, Mode, Plan, Project } from '../types'
import { LOCALE_HELPER, SWITCH_CHOICES, guardWrites, localeHelperPath, sourceBase, switchPath } from './locale'
import { nextConfigPlan } from './next-config'
import { layoutEdits } from './next-layout'
import { importRewrites, localePath, routeMoves } from './next-routes'

const DEPS = { 'next-intl': '4.14.9' }
/** Used when the declared next version names no major, such as `latest` or `canary`. */
const LATEST_NEXT_MAJOR = 16

/** The major version of next the app declares. */
function nextMajor(files: (rel: string) => string | null): number {
  let version = ''
  try {
    const json = JSON.parse(files('package.json') ?? '{}') as Record<string, Record<string, string> | undefined>
    version = json.dependencies?.next ?? json.devDependencies?.next ?? ''
  } catch {
    version = ''
  }
  const major = /(\d+)/.exec(version)?.[1]
  return major ? Number(major) : LATEST_NEXT_MAJOR
}

const ROUTING = `import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['en', 'ar'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
})
`

const NAVIGATION = `import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
`

/** The request config: the requested locale when it is known, else English; Arabic alone in arabic mode. */
function requestFile(mode: Mode, messages: string): string {
  if (mode === 'arabic') {
    return `import { getRequestConfig } from 'next-intl/server'

export default getRequestConfig(async () => ({
  locale: 'ar',
  messages: (await import('${messages}/ar.json')).default,
}))
`
  }
  return `import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale
  return {
    locale,
    messages: (await import(\`${messages}/\${locale}.json\`)).default,
  }
})
`
}

const middlewareFile = (routing: string): string => `import createMiddleware from 'next-intl/middleware'
import { routing } from '${routing}'

export default createMiddleware(routing)

export const config = {
  matcher: '/((?!api|_next|_vercel|.*\\\\..*).*)',
}
`

const switchFile = (navigation: string): string => `'use client'

import { useLocale } from 'next-intl'
import { Link, usePathname } from '${navigation}'

const CHOICES = ${SWITCH_CHOICES}

/** Links to the current page in English and Arabic. Not placed by convert: add it where the app keeps its navigation. */
export function DualkitLanguageSwitch() {
  const pathname = usePathname()
  const locale = useLocale()
  return (
    <nav aria-label="Language">
      {CHOICES.map(({ code, label }) => (
        <Link key={code} href={pathname} locale={code} lang={code} aria-current={locale === code ? 'true' : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  )
}
`

const PASS_THROUGH = `import type { ReactNode } from 'react'

/** Passes pages through to the [locale] layout, which renders html and body. The root not-found page needs it. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}
`

/** Throws when the app has its own middleware or proxy, which convert cannot merge with next-intl's. */
function guardMiddleware(base: string, ours: string, text: string, files: (rel: string) => string | null): void {
  for (const name of ['middleware', 'proxy']) {
    for (const ext of ['ts', 'js', 'mjs', 'tsx', 'jsx']) {
      const path = `${base}${name}.${ext}`
      const existing = files(path)
      if (existing === null || (path === ours && existing === text)) continue
      throw new UnsupportedError(`This app already has ${path}. Convert cannot merge the next-intl middleware into it, so it stopped before changing anything.`)
    }
  }
}

const merge = (into: Record<string, Edit[]>, from: Record<string, Edit[]>): Record<string, Edit[]> => {
  const out = { ...into }
  for (const [path, edits] of Object.entries(from)) out[path] = [...(out[path] ?? []), ...edits]
  return out
}

/** The bilingual writes, moves and edits: routes under [locale], middleware or proxy, navigation and the switch. */
function bilingualParts(project: Project, appDir: string, files: (rel: string) => string | null, paths: readonly string[]) {
  const base = sourceBase(project)
  const moves = routeMoves(appDir, paths)
  const middlewarePath = `${base}${nextMajor(files) >= 16 ? 'proxy' : 'middleware'}.ts`
  const middleware = middlewareFile(specifierTo(middlewarePath, `${base}i18n/routing.ts`))
  guardMiddleware(base, middlewarePath, middleware, files)
  const keepsNotFound = paths.some((p) => /^not-found\.[jt]sx?$/.test(p.slice(appDir.length + 1)))
  const writes: Record<string, string> = {
    [`${base}i18n/routing.ts`]: ROUTING,
    [`${base}i18n/navigation.ts`]: NAVIGATION,
    [middlewarePath]: middleware,
    [switchPath(project)]: switchFile(specifierTo(switchPath(project), `${base}i18n/navigation.ts`)),
    ...(keepsNotFound ? { [`${appDir}/layout.tsx`]: PASS_THROUGH } : {}),
  }
  return { moves, writes, edits: importRewrites(appDir, moves, paths, files) }
}

/**
 * The plan that wires next-intl into a Next.js App Router app. Bilingual mode moves routes under
 * `[locale]` and adds routing, middleware (proxy on Next 16 and later), navigation and the language
 * switch. Both modes add the request config, the provider in the root layout, the next.config plugin
 * and the locale helper. Messages are not written here. Pure: `files` reads a root-relative file or
 * returns null, and `paths` lists every file in the project.
 */
export function wireNextIntl(project: Project, mode: Mode, files: (relPath: string) => string | null, paths: readonly string[]): Plan {
  const appDir = project.appDir ?? 'app'
  const base = sourceBase(project)
  const i18nDir = `${base}i18n`
  const messages = posix.relative(i18nDir, 'messages')
  const config = nextConfigPlan(files)
  const parts = mode === 'bilingual' ? bilingualParts(project, appDir, files, paths) : { moves: [], writes: {}, edits: {} }
  const writes: Record<string, string> = {
    ...parts.writes,
    [`${i18nDir}/request.ts`]: requestFile(mode, messages),
    [localeHelperPath(project)]: LOCALE_HELPER,
    ...config.writes,
  }
  const moved = new Set(parts.moves.map(([from]) => from))
  guardWrites(writes, files, moved)
  const layoutPath = moved.has(project.entry) ? localePath(appDir, project.entry) : project.entry
  const layoutText = files(project.entry)
  if (layoutText === null) throw new UnsupportedError(`Convert could not read the root layout at ${project.entry}.`)
  const layout = layoutEdits(layoutPath, layoutText, mode, {
    routing: specifierTo(layoutPath, `${i18nDir}/routing.ts`),
    promiseParams: nextMajor(files) >= 15,
  })
  const edits = merge(merge(parts.edits, config.edits), layout.length ? { [layoutPath]: layout } : {})
  return { writes, edits, moves: parts.moves, deps: { ...DEPS } }
}
