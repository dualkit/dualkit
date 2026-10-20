import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { minVersion, satisfies, valid, validRange } from 'semver'

const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies'] as const

/** undefined: no package.json or no tailwindcss in it. null: malformed. */
type Declared = { range: string } | null | undefined

const readJson = (path: string): unknown => {
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return undefined
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function declared(dir: string): Declared {
  const json = readJson(join(dir, 'package.json'))
  if (json === undefined) return undefined
  if (json === null || typeof json !== 'object') return null
  for (const field of DEP_FIELDS) {
    const deps = (json as Record<string, unknown>)[field]
    if (deps && typeof deps === 'object') {
      const range = (deps as Record<string, unknown>).tailwindcss
      if (range !== undefined) return typeof range === 'string' ? { range } : null
    }
  }
  return undefined
}

/** A folder holding .git (a directory, or a file in a worktree) is the top of a repository, where the walk stops. */
const isRepoTop = (dir: string): boolean => existsSync(join(dir, '.git'))
const isFsRoot = (dir: string): boolean => dirname(dir) === dir

/** The installed tailwindcss version seen from dir, looking up through node_modules for a hoisted install, never above the repository. */
function installed(dir: string): string | null {
  for (let d = dir; ; d = dirname(d)) {
    const json = readJson(join(d, 'node_modules', 'tailwindcss', 'package.json'))
    if (json && typeof json === 'object') {
      const version = (json as Record<string, unknown>).version
      if (typeof version === 'string' && valid(version)) return version
    }
    if (isRepoTop(d) || isFsRoot(d)) return null
  }
}

function fromRange(range: string): string | null {
  try {
    return minVersion(range)?.version ?? null
  } catch {
    return null
  }
}

/**
 * The installed copy counts when it satisfies the declared range, or when the range is not a semver
 * range at all (workspace:, catalog:, latest). A stale install outside the range gives way to the range.
 */
function versionFor(dir: string, range: string): string | null {
  const copy = installed(dir)
  if (copy && (!validRange(range) || satisfies(copy, range))) return copy
  return fromRange(range)
}

/** cwd for lint(). The walk goes past it up to the repository top, so an app inside a workspace finds a root-level tailwindcss. */
export type TailwindVersionResolver = (fileAbs: string, cwd: string) => string | null

/** A resolver with its own per-folder cache, so one lint run reads each package.json once. */
export function createTailwindVersion(): TailwindVersionResolver {
  const cache = new Map<string, string | null>()
  const forDir = (dir: string): string | null => {
    if (cache.has(dir)) return cache.get(dir) ?? null
    let result: string | null = null
    const found = declared(dir)
    if (found) result = versionFor(dir, found.range)
    else if (found === undefined && !isRepoTop(dir) && !isFsRoot(dir)) result = forDir(dirname(dir))
    cache.set(dir, result)
    return result
  }
  return (fileAbs) => forDir(dirname(resolve(fileAbs)))
}

/**
 * The Tailwind version for a file: the nearest package.json from the file's folder up to the
 * repository top (a folder holding .git) or the filesystem root that declares tailwindcss, then
 * its installed version when that satisfies the range, else the lowest version the range allows.
 * Null when none is found or the JSON or range does not parse.
 */
export const tailwindVersion: TailwindVersionResolver = createTailwindVersion()
