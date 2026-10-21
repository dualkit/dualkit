import { parseArgs } from 'node:util'
import { BenchError, RUN, SCREENS } from './config'

/** The run step has 345 minutes; stopping new builds at 320 leaves room for the ones in flight (up to 600 s each) to finish. */
export const DEADLINE_MS = 320 * 60_000

export type CliOptions = {
  month: string | undefined; model: string | undefined; fake: boolean
  summaryOnly: boolean; noSummary: boolean
  /** Print the resolved month and exit, for the workflow. */
  printMonth: boolean
  /** Print the study report for the month and exit: no builds, no summary. */
  study: boolean
  /** Epoch ms after which no new build starts, or undefined for none. */
  deadline: number | undefined
  /** Limits a live probe; the summary ignores both. */
  screen: string | undefined; runs: number | undefined
}

const OPTIONS = {
  month: { type: 'string' }, model: { type: 'string' }, fake: { type: 'boolean' },
  'summary-only': { type: 'boolean' }, 'no-summary': { type: 'boolean' }, 'no-deadline': { type: 'boolean' }, 'print-month': { type: 'boolean' }, study: { type: 'boolean' },
  screen: { type: 'string' }, runs: { type: 'string' },
} as const

function parseRuns(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > RUN.runs) throw new BenchError(`--runs must be a whole number from 1 to ${RUN.runs}, not "${raw}".`)
  return n
}

export function parseCli(argv: string[], now = Date.now()): CliOptions {
  let values
  try {
    values = parseArgs({ args: argv, options: OPTIONS, strict: true, allowPositionals: false }).values
  } catch (e) {
    throw new BenchError(e instanceof Error ? e.message : String(e))
  }
  if (values['summary-only'] && values['no-summary']) throw new BenchError('--summary-only and --no-summary cannot be used together.')
  if (values.screen !== undefined && !(SCREENS as readonly string[]).includes(values.screen))
    throw new BenchError(`No screen "${values.screen}". Screens: ${SCREENS.join(', ')}`)
  return {
    month: values.month, model: values.model, fake: values.fake ?? false,
    summaryOnly: values['summary-only'] ?? false, noSummary: values['no-summary'] ?? false, printMonth: values['print-month'] ?? false, study: values.study ?? false,
    deadline: values['no-deadline'] ? undefined : now + DEADLINE_MS,
    screen: values.screen, runs: parseRuns(values.runs),
  }
}
