import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { messagesPath, writeText, type Disk } from './apply'
import { DEFAULT_PORTS, WIDTHS, baselinePath, routeSlug } from './baseline'
import { CONFIG_FILE, checkConfigAnswers, writeConfigAnswers } from './config-answers'
import { RefusedError, commit, currentBranch, stage, stagedFiles } from './git'
import { LEDGER_FILE, messagesFor, readLedger, type LedgerEntry } from './ledger'
import { MAX_DIFF_RATIO, compare } from './match'
import { failFinish, snapshot } from './finish-undo'
import { detectProject } from './project'
import { renderConvertReport, type ReportData } from './report'
import { listRoutes } from './routes'
import { startServer } from './server'
import { STATE_DIR, STATE_FILE, readState, saveState } from './state'
import { readSummary } from './summary'
import type { ConvertIo, ConvertState, ConvertSummary, FinishOptions, PageOptions, Project, Shooter } from './types'

export const REPORT_FILE = 'dualkit-convert.md'
export const DIFF_DIR = `${STATE_DIR}/diff`
const TEST_TAIL_LINES = 40
const NEEDS_BROWSER = 'Finish needs a start command in dualkit.config.json and a browser to take screenshots with.'
const LOCALE_COOKIE = 'dk-locale'

/** What phase 2 needs from outside: phase 1's io plus an accessibility audit and a lint count. */
export type FinishIo = ConvertIo & {
  audit: (url: string, width: number, options?: PageOptions) => Promise<{ score: number; errors: number; warnings: number }>
  lint: (root: string) => Promise<number>
}

type Checks = Pick<ReportData, 'english' | 'arabic' | 'noBaseline'>

/** The Arabic URL path for a route, and the cookies that select Arabic where the locale is not in the URL. */
export function arabicTarget(project: Project, state: ConvertState, route: string): { path: string; options?: PageOptions } {
  if (state.mode === 'arabic') return { path: route }
  if (project.framework === 'next-app') return { path: route === '/' ? '/ar' : `/ar${route}` }
  return { path: route, options: { cookies: { [LOCALE_COOKIE]: 'ar' } } }
}

/** The files finish writes and commits, with the config file it was given. */
const ownFiles = (configFile: string): string[] => [messagesPath('en'), messagesPath('ar'), REPORT_FILE, LEDGER_FILE, configFile]

/** Refuses when the index already holds staged files finish would otherwise commit along with its own. */
async function assertNothingElseStaged(root: string, own: readonly string[]): Promise<void> {
  const others = (await stagedFiles(root)).filter((f) => !own.includes(f))
  if (others.length > 0) throw new RefusedError(`You have staged changes in ${others.join(', ')}. Commit or unstage them, then run finish again.`)
}

/** Refuses unless this is a branch convert made and phase 1 finished on it. Returns the state. */
async function guard(root: string): Promise<ConvertState> {
  const state = readState(root)
  if (!state) throw new RefusedError('There is no saved convert state here. Run dualkit convert first, then fill in the Arabic and run this again.')
  if (state.phase !== 'converted' && state.phase !== 'finished') {
    throw new RefusedError('This conversion has not finished converting yet. Run dualkit convert until it completes, then run this again.')
  }
  const branch = await currentBranch(root)
  if (branch !== `dualkit/${state.mode}`) {
    throw new RefusedError(`You are on ${branch}, but this conversion lives on dualkit/${state.mode}. Switch to that branch, then run dualkit convert --finish again.`)
  }
  return state
}

function pendingCheck(ledger: LedgerEntry[], force: boolean | undefined): void {
  const pending = ledger.filter((e) => e.status === 'pending').length
  if (pending > 0 && !force) {
    throw new RefusedError(`${pending} ${pending === 1 ? 'string is' : 'strings are'} still pending in ${LEDGER_FILE}. Fill in the Arabic and set each status to drafted, or run with --force to use English for those strings.`)
  }
}

/** Writes both messages files from the ledger. */
function writeMessages(root: string, ledger: LedgerEntry[]): void {
  const disk: Disk = { root, created: [] }
  const json = (locale: 'en' | 'ar'): string => JSON.stringify(messagesFor(ledger, locale), null, 2) + '\n'
  for (const locale of ['en', 'ar'] as const) writeText(disk, messagesPath(locale), json(locale))
}

/** Shoots English at each width and compares it with the baseline. A page with no baseline is listed instead. */
async function englishChecks(root: string, base: string, routes: string[], shoot: Shooter): Promise<Pick<Checks, 'english' | 'noBaseline'>> {
  const english: Checks['english'] = []
  const noBaseline: NonNullable<Checks['noBaseline']> = []
  for (const route of routes) {
    for (const width of WIDTHS) {
      const file = join(root, baselinePath(route, width))
      if (!existsSync(file)) { noBaseline.push({ route, width }); continue }
      const shot = await shoot(`${base}${route}`, width)
      const { ratio, diff } = compare(readFileSync(file), shot)
      let diffPath: string | undefined
      if (ratio >= MAX_DIFF_RATIO) {
        diffPath = `${DIFF_DIR}/${routeSlug(route)}-${width}.png`
        mkdirSync(join(root, DIFF_DIR), { recursive: true })
        writeFileSync(join(root, diffPath), diff)
      }
      english.push({ route, width, ratio, ...(diffPath ? { diffPath } : {}) })
    }
  }
  return { english, noBaseline }
}

async function arabicChecks(project: Project, state: ConvertState, base: string, routes: string[], audit: FinishIo['audit']): Promise<Checks['arabic']> {
  const arabic: Checks['arabic'] = []
  for (const route of routes) {
    const { path, options } = arabicTarget(project, state, route)
    for (const width of WIDTHS) {
      const result = await audit(`${base}${path}`, width, options)
      const usable = result && Number.isFinite(result.errors)
      const failed = { score: Number.NaN, errors: Number.NaN, warnings: Number.NaN }
      arabic.push({ route: `${path} at ${width}px`, ...(usable ? result : failed) })
    }
  }
  return arabic
}

/** Starts the app, runs every page check and stops the server, also when a check throws. */
async function runChecks(project: Project, state: ConvertState, routes: string[], { config, shoot, audit }: FinishIo, step: Step): Promise<Checks> {
  const { start: cmd } = config
  if (!cmd || !shoot) throw new RefusedError(NEEDS_BROWSER)
  const port = config.port ?? DEFAULT_PORTS[project.framework]
  step.name = 'starting the app'
  const server = await startServer(cmd, port, project.root).catch((error: unknown) => {
    throw new Error(`Could not start the app with "${cmd}". ${(error as Error).message}`, { cause: error })
  })
  try {
    step.name = 'checking the pages'
    const english = state.mode === 'bilingual' ? await englishChecks(project.root, server.url, routes, shoot) : { english: [], noBaseline: [] }
    return { ...english, arabic: await arabicChecks(project, state, server.url, routes, audit) }
  } finally {
    await server.stop()
  }
}

const emptySummary = (state: ConvertState, strings: number): ConvertSummary =>
  ({ branch: state.branch, filesChanged: 0, edits: 0, byKind: { tailwind: 0, css: 0, markup: 0, strings: 0, formats: 0, wiring: 0 }, changed: [], flags: [], strings, skipped: [] })

const tail = (out: string): string => out.trimEnd().split('\n').slice(-TEST_TAIL_LINES).join('\n')

type Step = { name: string }
type Ready = { root: string; options: FinishOptions; io: FinishIo; state: ConvertState; ledger: LedgerEntry[]; configFile: string; own: string[] }

/** Refuses, without writing anything, unless finish can run. Returns what the run needs. */
async function prepare(options: FinishOptions, ioIn: FinishIo): Promise<Ready> {
  const { root } = options
  const configFile = options.configFile ?? CONFIG_FILE
  const io: FinishIo = options.configAnswers ? { ...ioIn, config: { ...ioIn.config, ...options.configAnswers } } : ioIn
  if (options.configAnswers) checkConfigAnswers(root, configFile)
  const state = await guard(root)
  const ledger = readLedger(root)
  pendingCheck(ledger, options.force)
  if (!io.config.start || !io.shoot) throw new RefusedError(NEEDS_BROWSER)
  const own = ownFiles(configFile)
  await assertNothingElseStaged(root, own)
  return { root, options, io, state, ledger, configFile, own }
}

/** Writes the messages, runs the checks, writes the report and state, and commits. `step` names where it is. */
async function run(ready: Ready, step: Step): Promise<{ reportPath: string; passed: boolean }> {
  const { root, options, io, state, ledger, configFile, own } = ready
  const project = detectProject(root)
  const { routes, unreachable } = listRoutes(project, io.config)
  step.name = 'writing the messages'
  writeMessages(root, ledger)
  const checks = await runChecks(project, state, routes, io, step)
  step.name = 'running the tests'
  const tests = io.config.test ? await io.run(io.config.test, root) : undefined
  step.name = 'counting lint findings'
  const remainingLint = await io.lint(root)
  step.name = 'writing the report'
  const earlier = readSummary(root)
  const data: ReportData = {
    mode: state.mode, base: state.base, branch: state.branch, summary: earlier ?? emptySummary(state, ledger.length), ledger, ...checks,
    ...(earlier ? {} : { summaryMissing: true }),
    unreachable, remainingLint, ...(tests ? { tests: { code: tests.code, tail: tail(tests.out) } } : {}),
  }
  writeFileSync(join(root, REPORT_FILE), renderConvertReport(data))
  step.name = 'saving the state'
  saveState(root, { ...state, phase: 'finished' })
  // The config is written and staged only now, after the checks, and only when the person gave answers.
  step.name = 'saving your answers'
  if (options.configAnswers) writeConfigAnswers({ root, created: [] }, options.configAnswers, configFile)
  step.name = 'committing'
  await stage(root, own.filter((p) => (p !== configFile || options.configAnswers) && existsSync(join(root, p))))
  if ((await stagedFiles(root)).length) await commit(root, `dualkit: finish ${state.mode} conversion`)
  const checked = checks.arabic.length > 0
  const passed = checked && checks.english.every((p) => p.ratio < MAX_DIFF_RATIO) && checks.arabic.every((p) => p.errors === 0) && (tests?.code ?? 0) === 0
  return { reportPath: join(root, REPORT_FILE), passed }
}

/**
 * Phase 2: writes the messages from the ledger, serves the app, checks English against the baseline and
 * audits the Arabic pages, writes dualkit-convert.md and commits it with the messages and the ledger.
 * When a step fails after writing starts, finish puts its own files back and commits nothing.
 */
export async function finish(options: FinishOptions, ioIn: FinishIo): Promise<{ reportPath: string; passed: boolean }> {
  const ready = await prepare(options, ioIn)
  const { root, configFile, own } = ready
  const written = [messagesPath('en'), messagesPath('ar'), REPORT_FILE, STATE_FILE, ...(options.configAnswers ? [configFile] : [])]
  const saved = await snapshot(root, written)
  const step: Step = { name: 'writing the messages' }
  const result = await run(ready, step).catch((error: unknown) => failFinish(root, saved, own.filter((p) => !written.includes(p)), step.name, error))
  ready.io.log(result.passed ? 'All checks passed.' : 'Some checks failed. The report lists them.')
  return result
}
