import { existsSync, readFileSync, readdirSync, statSync, type Dirent, type Stats } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import ignore, { type Ignore } from 'ignore'
import type { Skipped } from './types'

export const EXTENSIONS: readonly string[] = ['.css', '.scss', '.html', '.htm', '.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx', '.vue', '.svelte']
export const ALWAYS_SKIP: readonly string[] = ['node_modules', 'dist', '.next', 'build', 'coverage', '.git']
export const MINIFIED_BYTES = 1024 * 1024
export const MINIFIED_LINE = 500

const toPosix = (p: string): string => p.split(sep).join('/')

export const isLintable = (name: string): boolean => {
  const lower = name.toLowerCase()
  return !/\.d\.[mc]?ts$/.test(lower) && EXTENSIONS.some((ext) => lower.endsWith(ext))
}

/** Over 1 MB, or an average line longer than 500 characters. */
export function isMinified(text: string): boolean {
  if (text.length > MINIFIED_BYTES) return true
  if (text.length <= MINIFIED_LINE) return false
  let lines = 1
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) lines++
  return text.length / lines > MINIFIED_LINE
}

export type Ignored = (abs: string, isDir: boolean) => boolean

const inside = (parent: string, child: string): boolean => {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/** The nearest directory at or above dir that holds a .git entry, or null. */
export function repoTop(dir: string): string | null {
  for (let d = dir; ; d = dirname(d)) {
    if (existsSync(join(d, '.git'))) return d
    if (dirname(d) === d) return null
  }
}

/**
 * Where .gitignore matching starts for a walked directory: its repository top, else cwd when the
 * directory is inside cwd, else the directory itself.
 */
function ignoreRoot(dir: string, cwd: string): string {
  return repoTop(dir) ?? (inside(cwd, dir) ? cwd : dir)
}

/** Reads .gitignore files from the root down, caching one matcher per directory. */
export function gitignores(root: string): Ignored {
  const cache = new Map<string, Ignore | null>()
  const matcher = (dir: string): Ignore | null => {
    if (cache.has(dir)) return cache.get(dir) ?? null
    let ig: Ignore | null = null
    try {
      ig = ignore().add(readFileSync(join(dir, '.gitignore'), 'utf8'))
    } catch {
      ig = null
    }
    cache.set(dir, ig)
    return ig
  }
  return (abs, isDir) => {
    const rel = relative(root, abs)
    if (rel === '' || !inside(root, abs)) return false
    const parts = rel.split(sep)
    for (let i = 0; i < parts.length; i++) {
      const ig = matcher(join(root, ...parts.slice(0, i)))
      const below = parts.slice(i).join('/')
      if (ig && ig.ignores(isDir ? `${below}/` : below)) return true
    }
    return false
  }
}

/** The walker never reads file contents; lint() reads each file once and checks it for minified code there. */
export type Walked = { files: string[]; skipped: Skipped[] }

/** Lists lintable files under paths, relative to cwd with forward slashes. Symlinked directories are not followed. */
export function walk(paths: string[], cwd: string): Walked {
  const matchers = new Map<string, Ignored>()
  const ignoredFor = (dir: string): Ignored => {
    const root = ignoreRoot(dir, cwd)
    const known = matchers.get(root)
    if (known) return known
    const made = gitignores(root)
    matchers.set(root, made)
    return made
  }
  const files = new Set<string>()
  const skipped: Skipped[] = []
  const seen = new Set<string>()

  const addFile = (abs: string, size: number): void => {
    const rel = toPosix(relative(cwd, abs))
    if (seen.has(rel)) return
    seen.add(rel)
    // Over 1 MB is minified, known from stat without reading it. Long lines are checked in lint().
    if (size > MINIFIED_BYTES) skipped.push({ file: rel, reason: 'minified' })
    else files.add(rel)
  }

  const visit = (dir: string, ignored: Ignored): void => {
    let entries: Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      skipped.push({ file: toPosix(relative(cwd, dir)), reason: 'unreadable' })
      return
    }
    for (const entry of entries) {
      const abs = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!ALWAYS_SKIP.includes(entry.name) && !ignored(abs, true)) visit(abs, ignored)
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        if (!isLintable(entry.name) || ignored(abs, false)) continue
        const stat = statSafe(abs)
        if (stat?.isFile()) addFile(abs, stat.size)
      }
    }
  }

  for (const p of paths) {
    const abs = resolve(cwd, p)
    const stat = statSafe(abs)
    if (!stat) skipped.push({ file: toPosix(p), reason: 'not found' })
    else if (stat.isDirectory()) visit(abs, ignoredFor(abs))
    else if (!stat.isFile()) continue
    else if (isLintable(abs)) addFile(abs, stat.size)
    else skipped.push({ file: toPosix(p), reason: 'unsupported file type' })
  }
  return { files: [...files].sort(compare), skipped }
}

function statSafe(abs: string): Stats | undefined {
  try {
    return statSync(abs)
  } catch {
    return undefined
  }
}

/** Plain code-unit order, so results do not depend on the locale. */
export const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
