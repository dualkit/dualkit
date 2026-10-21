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
const LOCALE_NAME = /^([a-z]{2,3})(?:[-_][a-z0-9]+)*$/i

const isRtlName = (part: string): boolean => {
  const match = LOCALE_NAME.exec(part)
  return match !== null && RTL_CODES.has(match[1]!.toLowerCase())
}

/** True when a folder is named for an RTL locale, or a file is, such as ar-SA.po or messages.he.json. Names only. */
export function isRtlLocalePath(path: string): boolean {
  const parts = path.split(/[\\/]/)
  const file = parts.pop() ?? ''
  return parts.some(isRtlName) || file.split('.').some(isRtlName)
}

const SCAN_DEPTH = 6
const SCAN_SKIP = new Set(['node_modules', '.git'])

/** Looks at file and folder names under top, breadth first to a bounded depth, and stops at the first RTL locale name. */
export function hasRtlLocaleFiles(top: string, ignored: Ignored): boolean {
  let level = [top]
  for (let depth = 0; depth <= SCAN_DEPTH && level.length > 0; depth++) {
    const next: string[] = []
    for (const dir of level) {
      let entries: Dirent[]
      try {
        entries = readdirSync(dir, { withFileTypes: true })
      } catch {
        continue
      }
      for (const entry of entries) {
        const abs = join(dir, entry.name)
        if (entry.isDirectory()) {
          if (SCAN_SKIP.has(entry.name) || ignored(abs, true)) continue
          if (isRtlName(entry.name)) return true
          next.push(abs)
        } else if (isRtlLocalePath(entry.name) && !ignored(abs, false)) {
          return true
        }
      }
    }
    level = next
  }
  return false
}
