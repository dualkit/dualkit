/** One text replacement, as offsets into `SourceFile.text`. */
export type Edit = { start: number; end: number; text: string }

export type FlagKind =
  | 'no-logical-form' | 'computed-class' | 'inline-svg-icon' | 'mixed-text'
  | 'outside-component' | 'format' | 'unparsed' | 'unsupported'

/** Something convert left for a person or agent to finish. */
export type Flag = { file: string; line: number; kind: FlagKind; message: string; suggestion: string }

/** What a transform pass returns for one file. */
export type FileResult = { edits: Edit[]; flags: Flag[] }

/** `bilingual` keeps English and adds Arabic; `arabic` converts in place. */
export type Mode = 'bilingual' | 'arabic'

/** Optional settings read from the app's dualkit config. */
export type ConvertConfig = {
  start?: string
  port?: number
  routes?: string[]
  params?: Record<string, string>
  storageState?: string
  test?: string
}

/** What convert detected about the app it will convert. `entry` is the root layout (Next) or the createRoot file (Vite). */
export type Project = {
  root: string
  framework: 'next-app' | 'vite-react'
  appDir: string | null
  entry: string
  tailwind: string | null
  i18n: 'next-intl' | 'react-i18next' | null
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun'
}
