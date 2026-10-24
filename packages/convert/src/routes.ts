import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { ConvertConfig, Project } from './types'

type Unreachable = { route: string; reason: string }

const NEEDS_PARAMS = 'needs sample params in dualkit.config.json'
const PAGE = /^page\.(tsx|jsx|ts|js)$/
const GROUP = /^\([^.)][^)]*\)$/
const INTERCEPTING = /^\(\.{1,3}\)/
const GENERATED_CATCH_ALL = '[...rest]'
const DYNAMIC = /^\[.+\]$/

/** Every folder path (as segment lists) under dir that holds a page file, skipping parallel and intercepting folders. */
function pageFolders(dir: string, segments: string[] = []): string[][] {
  const entries = readdirSync(dir, { withFileTypes: true })
  const here = entries.some((e) => e.isFile() && PAGE.test(e.name)) ? [segments] : []
  const nested = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('@') && !e.name.startsWith('_') && !INTERCEPTING.test(e.name) && e.name !== 'node_modules')
    .flatMap((e) => pageFolders(join(dir, e.name), [...segments, e.name]))
  return [...here, ...nested]
}

function nextRoutes(project: Project, config: ConvertConfig): { routes: string[]; unreachable: Unreachable[] } {
  const routes: string[] = []
  const unreachable: Unreachable[] = []
  const appPath = join(project.root, project.appDir ?? 'app')
  if (!existsSync(appPath)) throw new Error(`The app folder ${appPath} does not exist, so there are no pages to list.`)
  for (const folder of pageFolders(appPath)) {
    const visible = folder.filter((s) => !GROUP.test(s))
    if (visible.length === 2 && visible[0] === '[locale]' && visible[1] === GENERATED_CATCH_ALL) continue
    const first = visible[0]
    const segments = first === '[locale]' ? visible.slice(1) : visible
    const route = `/${segments.join('/')}`
    if (!segments.some((s) => DYNAMIC.test(s))) {
      routes.push(route)
      continue
    }
    const sample = config.params?.[route]
    if (sample) routes.push(sample)
    else unreachable.push({ route, reason: NEEDS_PARAMS })
  }
  return { routes: routes.sort(), unreachable: unreachable.sort((a, b) => a.route.localeCompare(b.route)) }
}

/** The pages the check can visit. Next reads the app folder; Vite uses config.routes. Dynamic and catch-all routes need config.params. */
export function listRoutes(project: Project, config: ConvertConfig): { routes: string[]; unreachable: Unreachable[] } {
  if (project.framework === 'vite-react') return { routes: config.routes ?? ['/'], unreachable: [] }
  return nextRoutes(project, config)
}
