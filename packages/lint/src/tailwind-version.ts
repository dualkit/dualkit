import { readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { minVersion, valid } from 'semver'

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

/** True when dir is root or inside it. */
const within = (dir: string, root: string): boolean => {
  const rel = relative(root, dir)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

/** The installed tailwindcss version seen from dir, looking up through node_modules for a hoisted install, never above root. */
function installed(dir: string, root: string): string | null {
  for (let d = dir; within(d, root); d = dirname(d)) {
    const json = readJson(join(d, 'node_modules', 'tailwindcss', 'package.json'))
    if (json && typeof json === 'object') {
      const version = (json as Record<string, unknown>).version
      if (typeof version === 'string' && valid(version)) return version
    }
    if (d === root || dirname(d) === d) break
  }
  return null
}

function fromRange(range: string): string | null {
  try {
    return minVersion(range)?.version ?? null
  } catch {
    return null
  }
}

export type TailwindVersionResolver = (fileAbs: string, root: string) => string | null

/** A resolver with its own per-folder cache, so one lint run reads each package.json once. */
export function createTailwindVersion(): TailwindVersionResolver {
  const cache = new Map<string, string | null>()
  const forDir = (dir: string, root: string): string | null => {
    const key = `${root}\0${dir}`
    const hit = cache.get(key)
    if (hit !== undefined || cache.has(key)) return hit ?? null
    let result: string | null = null
    const found = declared(dir)
    if (found === null) result = null
    else if (found) result = installed(dir, root) ?? fromRange(found.range)
    else if (dir !== root && dirname(dir) !== dir) result = forDir(dirname(dir), root)
    cache.set(key, result)
    return result
  }
  return (fileAbs, root) => {
    const top = resolve(root)
    const dir = dirname(resolve(fileAbs))
    return within(dir, top) ? forDir(dir, top) : null
  }
}

/**
 * The Tailwind version for a file: the nearest package.json between the file and root that
 * declares tailwindcss, then its installed version, else the lowest version its range allows.
 * Null when none is found or the JSON or range does not parse.
 */
export const tailwindVersion: TailwindVersionResolver = createTailwindVersion()
