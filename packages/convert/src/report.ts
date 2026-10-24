import type { LedgerEntry } from './ledger'
import { MAX_DIFF_RATIO } from './match'
import type { ConvertSummary, Flag, Mode } from './types'

/** Everything the report needs, gathered by `--finish`. */
export type ReportData = {
  mode: Mode
  base: string
  branch: string
  summary: ConvertSummary
  ledger: LedgerEntry[]
  english: { route: string; width: number; ratio: number; diffPath?: string }[]
  /** English pages with no baseline screenshot to compare against. They are listed, and they do not fail the run. */
  noBaseline?: { route: string; width: number }[]
  arabic: { route: string; score: number; errors: number; warnings: number }[]
  unreachable: { route: string; reason: string }[]
  remainingLint: number
  tests?: { code: number; tail: string }
  /** True when the phase 1 summary file was not found, so the What changed counts are unknown. */
  summaryMissing?: boolean
}

const NATIVE_SPEAKER_LINE = 'Drafted by a model. A native speaker should check these before release.'

/** Makes user text safe inside a Markdown table cell or list item. */
function esc(text: string): string {
  return text.replace(/\s*\r?\n\s*/g, ' ').replace(/([\\`*_[\]<>|#])/g, '\\$1').trim()
}

/** A relative Markdown link to a file, or to a line in it when `line` is given. */
function link(file: string, line?: number): string {
  const path = file.replace(/\\/g, '/').replace(/^\.\//, '')
  const target = encodeURI(path).replace(/[()#]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
  return line === undefined ? `[${esc(path)}](${target})` : `[${esc(`${path}:${line}`)}](${target}#L${line})`
}

const KIND_LABELS: Record<keyof ConvertSummary['byKind'], string> = {
  tailwind: 'Tailwind classes', css: 'CSS rules', markup: 'Markup', strings: 'Strings', formats: 'Formats', wiring: 'Wiring'
}

/** Most changed files listed before the rest are counted. */
const MAX_LISTED_FILES = 30

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

const section = (title: string, lines: string[], empty: string): string =>
  `## ${title}\n\n${(lines.length > 0 ? lines : [empty]).join('\n')}`

function flagLine(flag: Flag): string {
  const where = link(flag.file, flag.line)
  const message = esc(flag.message)
  if (!flag.suggestion.trim()) return `- ${where}: ${message}`
  return `- ${where}: ${message.replace(/\.+$/, '')}. ${esc(flag.suggestion)}`
}

function kindLines(summary: ConvertSummary): string[] {
  const kinds = Object.keys(KIND_LABELS) as (keyof typeof KIND_LABELS)[]
  return kinds.filter((k) => summary.byKind[k] > 0).map((k) => `- ${KIND_LABELS[k]}: ${plural(summary.byKind[k], 'edit', 'edits')}`)
}

function fileLines(summary: ConvertSummary): string[] {
  if (summary.changed.length === 0) return []
  const shown = summary.changed.slice(0, MAX_LISTED_FILES)
  const more = summary.changed.length - shown.length
  return [
    '',
    'Changed files:',
    '',
    ...shown.map((c) => `- ${link(c.file)} (${plural(c.edits, 'edit', 'edits')})`),
    ...(more > 0 ? [`- and ${more} more`] : [])
  ]
}

function changed(data: ReportData): string {
  const { summary } = data
  const notes = summary.flags.filter((f) => f.kind === 'info')
  const lines = [
    ...(data.summaryMissing ? ['The phase 1 summary was not found, so the counts below are unknown.', ''] : []),
    `Mode: ${data.mode}. Branch: ${esc(data.branch)}, made from ${esc(data.base)}.`,
    '',
    `- ${plural(summary.filesChanged, 'file', 'files')} changed with ${plural(summary.edits, 'edit', 'edits')}.`,
    `- ${plural(summary.strings, 'string', 'strings')} moved into translation files.`,
    `- ${plural(data.remainingLint, 'lint issue', 'lint issues')} left after conversion.`,
    ...kindLines(summary),
    ...fileLines(summary),
    ...notes.map(flagLine)
  ]
  return section('What changed', lines, '')
}

function copy(data: ReportData): string {
  const todo = data.ledger.filter((e) => e.status === 'pending' || e.status === 'drafted')
  const lines =
    todo.length === 0
      ? []
      : [
          NATIVE_SPEAKER_LINE,
          '',
          '| Key | English | Arabic | Status | Where |',
          '| --- | --- | --- | --- | --- |',
          ...todo.map((e) => `| ${esc(e.key)} | ${esc(e.en)} | ${esc(e.ar)} | ${e.status} | ${link(e.file, e.line)} |`)
        ]
  return section('Arabic copy to check', lines, 'No Arabic copy needs checking.')
}

function suggestions(data: ReportData): string {
  const lines = data.summary.flags.filter((f) => f.kind === 'format').map(flagLine)
  return section('Regional suggestions', lines, 'No regional suggestions.')
}

function english(data: ReportData): string {
  const lines = data.english.map((p) => {
    const pass = p.ratio < MAX_DIFF_RATIO
    const share = `${(p.ratio * 100).toFixed(3)}% of pixels differ, limit ${(MAX_DIFF_RATIO * 100).toFixed(3)}%`
    const diff = !pass && p.diffPath ? `. Diff at ${esc(p.diffPath)}` : ''
    return `- ${esc(p.route)} at ${p.width}px: ${pass ? 'pass' : 'fail'}: ${share}${diff}`
  })
  const missing = (data.noBaseline ?? []).map((p) => `- ${esc(p.route)} at ${p.width}px: no English baseline was taken`)
  const unproven = lines.length === 0 && missing.length > 0 ? ['', 'Warning: No English pages were compared, so the English match is not proven.'] : []
  return section('English pages', [...lines, ...missing, ...unproven], 'No English pages were checked.')
}

function arabic(data: ReportData): string {
  const lines = data.arabic.map(
    (p) => !Number.isFinite(p.errors) ? `- ${esc(p.route)}: the check returned no result` : `- ${esc(p.route)}: score ${p.score}, ${plural(p.errors, 'error', 'errors')}, ${plural(p.warnings, 'warning', 'warnings')}`
  )
  return section('Arabic pages', lines, 'No pages were checked.')
}

function notConverted(data: ReportData): string {
  const flags = data.summary.flags.filter((f) => f.kind !== 'info' && f.kind !== 'format').map(flagLine)
  const skipped = data.summary.skipped.map((s) => `- Skipped ${esc(s.file)}: ${esc(s.reason)}`)
  const pages = data.unreachable.map((u) => `- Could not reach ${esc(u.route)}: ${esc(u.reason)}`)
  return section('What Dualkit could not convert', [...flags, ...skipped, ...pages], 'Nothing was left unconverted.')
}

function tests(data: ReportData): string {
  if (!data.tests) return section("The app's tests", [], 'The app\'s tests were not run, because dualkit.config.json has no test command. Add one under "convert", such as "test": "npm test".')
  const runs = Math.max(2, ...(data.tests.tail.match(/`+/g) ?? []).map((m) => m.length + 1))
  const fence = '`'.repeat(Math.max(3, runs))
  const result = data.tests.code === 0 ? 'The tests passed.' : `The tests failed with exit code ${data.tests.code}.`
  return section("The app's tests", [result, '', fence, data.tests.tail.trimEnd(), fence], '')
}

/** Renders the Markdown report that `dualkit convert --finish` writes. */
export function renderConvertReport(data: ReportData): string {
  const parts = [
    '# Dualkit convert report',
    changed(data),
    copy(data),
    suggestions(data),
    ...(data.mode === 'bilingual' ? [english(data)] : []),
    arabic(data),
    notConverted(data),
    tests(data)
  ]
  return `${parts.join('\n\n')}\n`
}
