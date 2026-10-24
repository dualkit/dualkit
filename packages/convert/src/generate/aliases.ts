import { posix } from 'node:path'

/** One `compilerOptions.paths` entry, with each target joined to baseUrl and relative to the project root. */
export type Alias = { key: string; targets: string[] }

const CONFIGS = ['tsconfig.json', 'jsconfig.json']
const EXTENSIONS = ['', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs', '.mts', '.cts']

/** JSON with comments and trailing commas, as tsconfig allows, made plain JSON. Comment markers inside strings are kept. */
function stripJsonc(text: string): string {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (c === '"') {
      const start = i
      for (i++; i < text.length && text[i] !== '"'; i++) if (text[i] === '\\') i++
      out += text.slice(start, i + 1)
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++
      out += '\n'
    } else if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2)
      if (i === -1) break
      i++
    } else out += c
  }
  return out.replace(/,(\s*[}\]])/g, '$1')
}

/** How specific a key is: an exact key beats any pattern, a longer prefix beats a shorter one. */
const prefixLength = (key: string): number => (key.includes('*') ? key.indexOf('*') : Number.MAX_SAFE_INTEGER)

/** The path aliases in the app's tsconfig.json, else its jsconfig.json. `extends` is not followed. */
export function readAliases(files: (rel: string) => string | null): Alias[] {
  for (const name of CONFIGS) {
    const text = files(name)
    if (text === null) continue
    let options: { baseUrl?: unknown; paths?: unknown }
    try {
      options = ((JSON.parse(stripJsonc(text)) as { compilerOptions?: typeof options }).compilerOptions) ?? {}
    } catch {
      return []
    }
    const base = typeof options.baseUrl === 'string' ? options.baseUrl : '.'
    const paths = options.paths && typeof options.paths === 'object' ? (options.paths as Record<string, unknown>) : {}
    return Object.entries(paths)
      .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].every((t) => typeof t === 'string'))
      .map(([key, targets]) => ({ key, targets: targets.map((t) => posix.join(base, t)) }))
      .sort((a, b) => prefixLength(b.key) - prefixLength(a.key))
  }
  return []
}

/** The text a pattern's `*` stands for in a value, or null when the value does not fit the pattern. */
function capture(pattern: string, value: string): string | null {
  const star = pattern.indexOf('*')
  if (star === -1) return pattern === value ? '' : null
  const [prefix, suffix] = [pattern.slice(0, star), pattern.slice(star + 1)]
  const fits = value.startsWith(prefix) && value.endsWith(suffix) && value.length >= prefix.length + suffix.length
  return fits ? value.slice(prefix.length, value.length - suffix.length) : null
}

/** The existing file a module path refers to, trying the usual extensions and index files. */
export function resolveFile(target: string, has: (path: string) => boolean): string | null {
  const stem = target.replace(/\.(js|jsx|mjs|cjs)$/, '')
  const candidates = [target, ...EXTENSIONS.map((e) => `${stem}${e}`), ...EXTENSIONS.slice(1).map((e) => `${target}/index${e}`)]
  return candidates.find(has) ?? null
}

/** An alias import resolved to a module path, with a way to write a new module path back in the same alias form. `respell` gives null when the alias has no `*` and cannot name another path. */
export type AliasTarget = { path: string; file: string; respell: (path: string) => string | null }

/** Resolves an aliased specifier the way TypeScript does: the best matching key, then its targets in order. Null when nothing resolves. */
export function resolveAlias(spec: string, aliases: Alias[], has: (path: string) => boolean): AliasTarget | null {
  const alias = aliases.find((a) => capture(a.key, spec) !== null)
  if (!alias) return null
  const star = capture(alias.key, spec)!
  for (const target of alias.targets) {
    // Function replacers, so a `$` in a path is never read as a replacement pattern.
    const path = target.replace('*', () => star)
    const file = resolveFile(path, has)
    if (!file) continue
    const respell = (next: string): string | null => {
      const middle = target.includes('*') ? capture(target, next) : null
      return middle === null ? null : alias.key.replace('*', () => middle)
    }
    return { path, file, respell }
  }
  return null
}
