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
  arabic: { route: string; score: number; errors: number; warnings: number }[]
  unreachable: { route: string; reason: string }[]
  remainingLint: number
  tests?: { code: number; tail: string }
}

const NATIVE_SPEAKER_LINE = 'Drafted by a model. A native speaker should check these before release.'

/** Makes user text safe inside a Markdown table cell or list item. */
function esc(text: string): string {
  return text.replace(/\s*\r?\n\s*/g, ' ').replace(/([\\`*_[\]<>|#])/g, '\\$1').trim()
}

/** A relative Markdown link to a line in a file. */
function link(file: string, line: number): string {
  const path = file.replace(/\\/g, '/').replace(/^\.\//, '')
  const target = encodeURI(path).replace(/[()]/g, (c) => (c === '(' ? '%28' : '%29'))
  return `[${esc(`${path}:${line}`)}](${target}#L${line})`
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

const section = (title: string, lines: string[], empty: string): string =>
  `## ${title}\n\n${(lines.length > 0 ? lines : [empty]).join('\n')}`

function flagLine(flag: Flag): string {
  const where = link(flag.file, flag.line)
  const tail = flag.suggestion ? ` ${esc(flag.suggestion)}` : ''
  return `- ${where}: ${esc(flag.message)}${tail}`
}

function changed(data: ReportData): string {
  const { summary } = data
  const notes = summary.flags.filter((f) => f.kind === 'info')
  const lines = [
    `Mode: ${data.mode}. Branch: ${esc(data.branch)}, made from ${esc(data.base)}.`,
    '',
    `- ${plural(summary.filesChanged, 'file', 'files')} changed with ${plural(summary.edits, 'edit', 'edits')}.`,
    `- ${plural(summary.strings, 'string', 'strings')} moved into translation files.`,
    `- ${plural(data.remainingLint, 'lint issue', 'lint issues')} left after conversion.`,
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
    const share = `${(p.ratio * 100).toFixed(2)}% of pixels differ`
    const diff = !pass && p.diffPath ? `, diff at ${esc(p.diffPath)}` : ''
    return `- ${esc(p.route)} at ${p.width}px: ${pass ? 'pass' : 'fail'} (${share}${diff})`
  })
  return section('English pages', lines, 'No English pages were checked.')
}

function arabic(data: ReportData): string {
  const lines = data.arabic.map(
    (p) => `- ${esc(p.route)}: score ${p.score}, ${plural(p.errors, 'error', 'errors')}, ${plural(p.warnings, 'warning', 'warnings')}`
  )
  return section('Arabic pages', lines, 'No Arabic pages were checked.')
}

function notConverted(data: ReportData): string {
  const flags = data.summary.flags.filter((f) => f.kind !== 'info' && f.kind !== 'format').map(flagLine)
  const skipped = data.summary.skipped.map((s) => `- Skipped ${esc(s.file)}: ${esc(s.reason)}`)
  const pages = data.unreachable.map((u) => `- Could not reach ${esc(u.route)}: ${esc(u.reason)}`)
  return section('What Dualkit could not convert', [...flags, ...skipped, ...pages], 'Nothing was left unconverted.')
}

function tests(data: ReportData): string {
  if (!data.tests) return section("The app's tests", [], "The app's tests were not run.")
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
