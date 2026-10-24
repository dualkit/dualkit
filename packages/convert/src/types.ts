/** One text replacement, as offsets into `SourceFile.text`. */
export type Edit = { start: number; end: number; text: string }

export type FlagKind =
  | 'no-logical-form' | 'computed-class' | 'inline-svg-icon' | 'mixed-text'
  | 'outside-component' | 'format' | 'unparsed' | 'unsupported' | 'info'

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

/** What locale wiring changes, with paths relative to the project root. Edits are keyed by post-move paths. Flags are for the report. */
export type Plan = {
  writes: Record<string, string>
  edits: Record<string, Edit[]>
  moves: [from: string, to: string][]
  deps: Record<string, string>
  flags: Flag[]
}

/** Answers the person gave at a prompt. They are merged into dualkit.config.json under `convert` and committed. */
export type ConfigAnswers = { start?: string; port?: number }

/** What phase 1 is asked to do. `root` is the app folder, inside a git repo. `configFile` is relative to root, dualkit.config.json by default. */
export type ConvertOptions = { root: string; mode: Mode; install: boolean; baseline: boolean; configAnswers?: ConfigAnswers; configFile?: string }

/** What phase 2 is asked to do. `force` uses English for pending strings. `configFile` is as for ConvertOptions. */
export type FinishOptions = { root: string; force?: boolean; configAnswers?: ConfigAnswers; configFile?: string }

/** Per-request browser settings. `cookies` are set before the page loads. */
export type PageOptions = { cookies?: Record<string, string> }

/** Takes a screenshot of url at a viewport width and returns the PNG. Injected by the CLI. */
export type Shooter = (url: string, width: number, options?: PageOptions) => Promise<Buffer>

/** What convert needs from outside: a logger, a command runner, the app's config, for the baseline a shooter, and an interrupt signal. */
export type ConvertIo = {
  log: (s: string) => void
  shoot?: Shooter
  run: (cmd: string, cwd: string) => Promise<{ code: number; out: string }>
  config: ConvertConfig
  /** Fires when the person interrupts the run. Convert checks it after slow steps and rolls back. */
  signal?: AbortSignal
}

/** The passes that make edits, plus wiring. */
export type EditKind = 'tailwind' | 'css' | 'markup' | 'strings' | 'formats' | 'wiring'

/** What a phase 1 run changed and left to finish. */
export type ConvertSummary = {
  branch: string
  filesChanged: number
  edits: number
  /** Applied edits per pass. Wiring counts its edits plus the files it wrote. */
  byKind: Record<EditKind, number>
  /** Files with applied edits, at post-move paths, sorted by file. */
  changed: { file: string; edits: number }[]
  flags: Flag[]
  strings: number
  skipped: { file: string; reason: string }[]
}

/** Saved to `.dualkit/convert.json`. `generated` lists the files convert wrote, which later runs leave alone. */
export type ConvertState = {
  mode: Mode
  base: string
  branch: string
  framework: Project['framework']
  phase: 'converted' | 'finished'
  generated: string[]
}
