import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, isAbsolute, join, relative } from 'node:path'
import type { QuietReason } from './types'

const HEADER_LINES = 5
const GENERATED = [/@generated\b/, /DO NOT EDIT/i, /^\s*(?:\/\*!?|\/\/)\s*tailwindcss v\d/i]

const EXAMPLE_SEGMENTS = new Set(['examples', 'example', 'demo', 'demos', 'fixtures', '__fixtures__', 'stories', 'storybook-static'])
const EMAIL_SEGMENTS = new Set(['mailer', 'mailers', 'email', 'emails', 'mail'])

/** Why physical rules cannot be bugs in this file, judged from its path (directory names only) and its first lines. */
export function quietReason(path: string, text: string): 'generated' | 'example' | 'email' | null {
  const head = text.split(/\r\n|\r|\n/, HEADER_LINES)
  if (head.some((line) => GENERATED.some((re) => re.test(line)))) return 'generated'
  const dirs = path.split(/[\\/]/).slice(0, -1).map((s) => s.toLowerCase())
  if (dirs.some((s) => EXAMPLE_SEGMENTS.has(s))) return 'example'
  if (dirs.some((s) => EMAIL_SEGMENTS.has(s))) return 'email'
  return null
}

/** Packages that mirror physical CSS at build time, so source written left and right is already correct. */
export const FLIPPERS: readonly string[] = ['rtlcss', 'postcss-rtlcss', 'postcss-rtl', 'cssjanus', 'stylis-plugin-rtl', '@mui/stylis-plugin-rtl']
const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies'] as const

function flipperIn(deps: unknown): string | null {
  if (typeof deps !== 'object' || deps === null) return null
  return FLIPPERS.find((name) => Object.hasOwn(deps, name)) ?? null
}

function fromPackageJson(dir: string): string | null {
  try {
    const pkg: unknown = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    if (typeof pkg !== 'object' || pkg === null) return null
    for (const field of DEP_FIELDS) {
      const found = flipperIn((pkg as Record<string, unknown>)[field])
      if (found) return found
    }
  } catch {
    // No package.json, or one that does not parse: it declares nothing.
  }
  return null
}

function fromGems(dir: string): string | null {
  let names: string[]
  try {
    names = readdirSync(dir).filter((n) => n === 'Gemfile' || n.endsWith('.gemspec'))
  } catch {
    return null
  }
  for (const name of names) {
    try {
      const text = readFileSync(join(dir, name), 'utf8')
      const found = FLIPPERS.find((f) => new RegExp(`['"]${f}['"]`).test(text))
      if (found) return found
    } catch {
      // Unreadable gem file: skip it.
    }
  }
  return null
}

const inside = (parent: string, child: string): boolean => {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/**
 * Finds a flipper declared in any package.json from a file's directory up to top, or in a Gemfile or
 * gemspec at top. Nothing above top is read. A file outside top finds nothing.
 */
export function createFlipperLookup(top: string): (abs: string) => string | null {
  const byDir = new Map<string, string | null>()
  const gems = fromGems(top)
  const search = (dir: string): string | null => {
    if (byDir.has(dir)) return byDir.get(dir) ?? null
    const own = existsSync(join(dir, 'package.json')) ? fromPackageJson(dir) : null
    const found = own ?? (dir === top ? gems : dirname(dir) === dir ? null : search(dirname(dir)))
    byDir.set(dir, found)
    return found
  }
  return (abs) => {
    const dir = dirname(abs)
    return inside(top, dir) ? search(dir) : null
  }
}
