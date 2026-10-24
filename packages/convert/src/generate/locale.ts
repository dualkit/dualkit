import { UnsupportedError } from '../project'
import type { Project } from '../types'

/** The cookie that holds the chosen locale outside Next.js. */
export const LOCALE_COOKIE = 'dk-locale'

/** The switch's choices, each named in its own language. */
export const SWITCH_CHOICES = "[\n  { code: 'en', label: 'English' },\n  { code: 'ar', label: 'العربية' },\n] as const"

/** The folder generated source goes in: `src/` when the app keeps its code there, else the root. */
export const sourceBase = (project: Project): string =>
  project.framework === 'vite-react' || project.appDir?.startsWith('src/') ? 'src/' : ''

/** Where the dkIntlLocale helper is written, relative to the project root. */
export const localeHelperPath = (project: Project): string => `${sourceBase(project)}lib/dualkit-locale.ts`

/** Where the language switch component is written, relative to the project root. */
export const switchPath = (project: Project): string => `${sourceBase(project)}components/dualkit-language-switch.tsx`

/** The dkIntlLocale helper: Arabic formats with the UAE region and Latin digits, anything else is unchanged. */
export const LOCALE_HELPER = `/** The Intl locale for an app locale: Arabic uses the UAE region with Latin digits, anything else is unchanged. */
export function dkIntlLocale(locale: string): string {
  return locale === 'ar' ? 'ar-AE-u-nu-latn' : locale
}
`

/**
 * Throws when a file convert would write already exists with other content, so the person's own
 * file is never overwritten. `replaced` lists paths whose old content moves away first.
 */
export function guardWrites(writes: Record<string, string>, files: (rel: string) => string | null, replaced: Set<string>): void {
  for (const [path, text] of Object.entries(writes)) {
    const existing = files(path)
    if (existing === null || existing === text || replaced.has(path)) continue
    throw new UnsupportedError(`This app already has ${path}. Convert cannot merge its own version into it, so move or remove that file and run convert again.`)
  }
}
