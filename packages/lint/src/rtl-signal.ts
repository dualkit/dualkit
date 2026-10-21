import { readdirSync, type Dirent } from 'node:fs'
import { join } from 'node:path'
import type { Ignored } from './walk'

const QUICK = /rtl/i

/**
 * Any sign that a codebase handles right-to-left: a dir attribute or property set to rtl, an rtl: variant,
 * :dir(rtl), [dir=rtl], an .rtl class on html or body, or an isRtl flag.
 */
const SIGNAL = new RegExp(
  [
    String.raw`\bdir\s*[=:][^\n]{0,60}['"]rtl['"]`,
    String.raw`(?<![A-Za-z0-9_-])rtl:`,
    String.raw`:dir\(\s*rtl`,
    String.raw`\[dir\s*=\s*["']?rtl`,
    String.raw`(?<![\w-])(?:html|body|:root)?\.rtl(?![\w-])`,
    String.raw`\bis_?rtl\b`,
  ].join('|'),
  'i',
)

/** True when the text shows the code handles right-to-left. */
export const hasRtlSignal = (text: string): boolean => QUICK.test(text) && SIGNAL.test(text)

/** Languages written right to left, as language codes in locale file and folder names. */
const RTL_CODES = new Set(['ar', 'he', 'iw', 'fa', 'ur', 'ps', 'sd', 'ug', 'yi', 'dv', 'ckb'])
const RTL_NAME = /^([a-z]{2,3})(?:[-_](?:[a-z]{4}|[a-z]{2}|\d{3}))*$/i
const LOCALE_FOLDERS = new Set(['locales', 'locale', 'i18n', 'lang', 'langs', 'languages', 'translations', 'messages', 'l10n', 'intl'])
const LOCALE_EXTENSIONS = new Set(['json', 'yml', 'yaml', 'po', 'xlf', 'xliff', 'properties', 'ftl', 'arb', 'strings', 'resx'])

const isRtlName = (part: string): boolean => {
  const match = RTL_NAME.exec(part)
  return match !== null && RTL_CODES.has(match[1]!.toLowerCase())
}

const isLocaleFolder = (name: string): boolean => LOCALE_FOLDERS.has(name.toLowerCase())

/** True when a file name has a translation file extension and a part of it names an RTL locale, such as ar-SA.po or messages.he.json. */
const isRtlLocaleFile = (file: string): boolean => {
  const parts = file.split('.')
  const ext = parts.length > 1 ? parts[parts.length - 1]!.toLowerCase() : ''
  return LOCALE_EXTENSIONS.has(ext) && parts.slice(0, -1).some(isRtlName)
}

/** True when a path names an RTL locale inside a locale folder, or in a translation file. Names only. */
export function isRtlLocalePath(path: string): boolean {
  const parts = path.split(/[\\/]/)
  const file = parts.pop() ?? ''
  if (isRtlLocaleFile(file)) return true
  const inLocaleFolder = parts.some(isLocaleFolder)
  if (!inLocaleFolder) return false
  const stem = file.split('.')
  return parts.some((part, i) => isRtlName(part) && parts.slice(0, i).some(isLocaleFolder)) || stem.slice(0, stem.length > 1 ? -1 : 1).some(isRtlName)
}

const SCAN_DEPTH = 6
const SCAN_SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'coverage', 'vendor', '.next'])
export const SCAN_LIMIT = 50_000

/**
 * Looks at file and folder names under top, breadth first to a bounded depth, and stops at the first RTL locale name.
 * Returns true too when it gives up after limit entries, since unknown counts as having support.
 */
export function hasRtlLocaleFiles(top: string, ignored: Ignored, limit: number = SCAN_LIMIT): boolean {
  let level = [{ abs: top, rel: '' }]
  let visited = 0
  for (let depth = 0; depth <= SCAN_DEPTH && level.length > 0; depth++) {
    const next: { abs: string; rel: string }[] = []
    for (const dir of level) {
      let entries: Dirent[]
      try {
        entries = readdirSync(dir.abs, { withFileTypes: true })
      } catch {
        continue
      }
      for (const entry of entries) {
        if (++visited > limit) return true
        const abs = join(dir.abs, entry.name)
        const rel = dir.rel ? `${dir.rel}/${entry.name}` : entry.name
        if (entry.isDirectory()) {
          if (SCAN_SKIP.has(entry.name) || ignored(abs, true)) continue
          if (isRtlLocalePath(`${rel}/x`)) return true
          next.push({ abs, rel })
        } else if (isRtlLocalePath(rel) && !ignored(abs, false)) {
          return true
        }
      }
    }
    level = next
  }
  return false
}
