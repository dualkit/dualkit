import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { listRoutes } from './routes'
import { startServer } from './server'
import { STATE_DIR } from './state'
import type { ConvertConfig, Project, Shooter } from './types'

export const BASELINE_DIR = `${STATE_DIR}/baseline`
/** The phone and desktop widths every page is shot at. */
export const WIDTHS = [390, 1280] as const
/** Used when the config names no port: the dev server default for each framework. */
export const DEFAULT_PORTS: Record<Project['framework'], number> = { 'next-app': 3000, 'vite-react': 5173 }

/** A route as a file name: `/` is `home`, `/orders/1` is `orders-1`. */
export const routeSlug = (route: string): string =>
  route.replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'home'

/** The root-relative path of one baseline screenshot. */
export const baselinePath = (route: string, width: number): string => `${BASELINE_DIR}/${routeSlug(route)}-${width}.png`

/**
 * Starts the app with the configured start command, shoots every reachable page at each width into
 * the baseline folder, and stops the server, also when a shot fails. Returns the paths written and the
 * pages it could not reach.
 */
export async function shootBaseline(
  project: Project, config: ConvertConfig & { start: string }, shoot: Shooter, log: (s: string) => void,
): Promise<{ shots: string[]; unreachable: { route: string; reason: string }[] }> {
  const { routes, unreachable } = listRoutes(project, config)
  const port = config.port ?? DEFAULT_PORTS[project.framework]
  mkdirSync(join(project.root, BASELINE_DIR), { recursive: true })
  const server = await startServer(config.start, port, project.root)
  const shots: string[] = []
  try {
    for (const route of routes) {
      for (const width of WIDTHS) {
        const path = baselinePath(route, width)
        writeFileSync(join(project.root, path), await shoot(`${server.url}${route}`, width))
        shots.push(path)
      }
    }
  } finally {
    await server.stop()
  }
  log(`Took ${shots.length} English baseline screenshots.`)
  return { shots, unreachable }
}
