import { parseSourceOutcome } from '@dualkit/lint'
import { posix } from 'node:path'
import { sideEffectImport, specifierTo } from '../transforms/imports'
import { styleOf, type Node } from '../transforms/strings'
import { lineOf } from '../transforms/lines'
import type { Edit, Flag, Mode, Plan, Project } from '../types'
import { LOCALE_COOKIE, LOCALE_HELPER, SWITCH_CHOICES, guardWrites, localeHelperPath, switchPath } from './locale'

const DEPS = { 'react-i18next': '17.1.6', i18next: '26.5.8' }
const INIT_PATH = 'src/i18n.ts'
const HTML_PATH = 'index.html'
const COOKIE_PATTERN = `/(?:^|; )${LOCALE_COOKIE}=([^;]*)/`

const messagesImport = (locale: 'en' | 'ar'): string =>
  `import ${locale} from '${posix.relative(posix.dirname(INIT_PATH), `messages/${locale}.json`)}'`

/** The i18next init: both locales chosen by the cookie in bilingual mode, Arabic alone in arabic mode. */
function initFile(mode: Mode): string {
  const head = "import i18n from 'i18next'\nimport { initReactI18next } from 'react-i18next'\n"
  const options = (resources: string, lng: string, fallback: string): string =>
    `void i18n.use(initReactI18next).init({\n  resources: ${resources},\n  lng: ${lng},\n  fallbackLng: '${fallback}',\n` +
    `  initAsync: false,\n  interpolation: { prefix: '{', suffix: '}', escapeValue: false },\n})\n\nexport default i18n\n`
  if (mode === 'arabic') return `${head}${messagesImport('ar')}\n\n${options('{ ar: { translation: ar } }', "'ar'", 'ar')}`
  return `${head}${messagesImport('en')}\n${messagesImport('ar')}\n\n` +
    `/** The locale saved in the ${LOCALE_COOKIE} cookie, else English. */\nfunction savedLocale(): 'en' | 'ar' {\n` +
    `  const match = ${COOKIE_PATTERN}.exec(document.cookie)\n  return match?.[1] === 'ar' ? 'ar' : 'en'\n}\n\n` +
    options('{ en: { translation: en }, ar: { translation: ar } }', 'savedLocale()', 'en')
}

/** The language switch: saves the choice in the cookie and reloads, so the inline script sets lang and dir before paint. */
const switchFile = (): string => `import { useTranslation } from 'react-i18next'

const CHOICES = ${SWITCH_CHOICES}

/** Buttons for English and Arabic. Not placed by convert: add it where the app keeps its navigation. */
export function DualkitLanguageSwitch() {
  const { i18n } = useTranslation()
  const choose = (code: string): void => {
    document.cookie = \`${LOCALE_COOKIE}=\${code}; path=/; max-age=31536000; samesite=lax\`
    window.location.reload()
  }
  return (
    <nav aria-label="Language">
      {CHOICES.map(({ code, label }) => (
        <button key={code} type="button" lang={code} aria-current={i18n.language === code ? 'true' : undefined} onClick={() => choose(code)}>
          {label}
        </button>
      ))}
    </nav>
  )
}
`

/** Sets lang and dir on <html> from the cookie before first paint. */
const INLINE_SCRIPT = `<script>(function(){var m=document.cookie.match(${COOKIE_PATTERN});var l=m&&m[1]==='ar'?'ar':'en';` +
  `var h=document.documentElement;h.lang=l;h.dir=l==='ar'?'rtl':'ltr'})()</script>`

/** The index.html edit: the inline script first in <head> (bilingual), or a fixed Arabic <html> (arabic). */
function htmlEdits(html: string, mode: Mode): Edit[] {
  if (mode === 'bilingual') {
    if (html.includes(LOCALE_COOKIE)) return []
    const head = /<head\b[^>]*>/i.exec(html)
    if (!head) return []
    const at = head.index + head[0].length
    return [{ start: at, end: at, text: `\n    ${INLINE_SCRIPT}` }]
  }
  const open = /<html\b([^>]*)>/i.exec(html)
  if (!open) return []
  const rest = open[1]!.replace(/\s(lang|dir)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  const text = `<html lang="ar" dir="rtl"${rest}>`
  return text === open[0] ? [] : [{ start: open.index, end: open.index + open[0].length, text }]
}

/** A flag for an English <title> in index.html, which stays as it is because no translation hook reaches it. */
function titleFlags(html: string): Flag[] {
  const title = /<title\b[^>]*>([^<]*)<\/title>/i.exec(html)
  const text = title?.[1]!.trim() ?? ''
  if (!title || !/[A-Za-z]/.test(text) || /\{\{|%\w+%/.test(text)) return []
  return [{
    file: HTML_PATH, line: lineOf(html, title.index), kind: 'outside-component',
    message: `The page title "${text}" in index.html stays in English.`,
    suggestion: 'Translate it in index.html for an Arabic-only app, or set document.title from a translated string in a component.',
  }]
}

/** The entry edit that imports the i18n init, or nothing when it is already imported. */
function entryEdits(entry: string, text: string): Edit[] {
  const outcome = parseSourceOutcome(entry, text)
  const block = 'file' in outcome ? outcome.file.js[0] : undefined
  if (!block) return []
  const program = block.ast.program as unknown as Node
  const spec = specifierTo(entry, INIT_PATH)
  const has = ((program.body as Node[]) ?? []).some((s) => s.type === 'ImportDeclaration'
    && [spec, `${spec}.ts`].includes(String((s.source as Node).value)))
  if (has) return []
  return [sideEffectImport(program, spec, block.offset, styleOf(program, text, block.offset))]
}

/**
 * The plan that wires react-i18next into a Vite React app: the i18next init, the inline script that sets
 * lang and dir from the dk-locale cookie, the import in the entry, the locale helper and, in bilingual
 * mode, the language switch. Pure: `files` reads the current text of a root-relative path, or null.
 */
export function wireReactI18next(project: Project, mode: Mode, files: (relPath: string) => string | null): Plan {
  const writes: Record<string, string> = {
    [INIT_PATH]: initFile(mode),
    [localeHelperPath(project)]: LOCALE_HELPER,
    ...(mode === 'bilingual' ? { [switchPath(project)]: switchFile() } : {}),
  }
  guardWrites(writes, files, new Set())
  const edits: Record<string, Edit[]> = {}
  const html = files(HTML_PATH)
  const htmlChange = html === null ? [] : htmlEdits(html, mode)
  if (htmlChange.length) edits[HTML_PATH] = htmlChange
  const entry = files(project.entry)
  const entryChange = entry === null ? [] : entryEdits(project.entry, entry)
  if (entryChange.length) edits[project.entry] = entryChange
  return { writes, edits, moves: [], deps: { ...DEPS }, flags: html === null ? [] : titleFlags(html) }
}
