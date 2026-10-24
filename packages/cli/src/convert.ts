import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ConvertConfig, ConvertIo, ConvertOptions, ConvertSummary, Mode, FinishIo } from '@dualkit/convert'
import { UserError, loadConfig, type Config } from './config'
import { askOnTerminal, InterruptedError, makeBrowserKit, runCommand, withInterrupt } from './convert-env'

/** The pieces of @dualkit/convert the command calls, so tests can stand in for them. */
export type ConvertApi = {
  convert: (options: ConvertOptions, io: ConvertIo) => Promise<ConvertSummary>
  finish: (options: { root: string; force?: boolean }, io: FinishIo) => Promise<{ reportPath: string; passed: boolean }>
  refusals: readonly (new (...args: never[]) => Error)[]
}

/** What the command needs from outside. Tests replace any of it. */
export type ConvertEnv = {
  api?: ConvertApi
  ask?: (question: string) => Promise<string>
  interactive?: boolean
  run?: ConvertIo['run']
  lint?: FinishIo['lint']
  shoot?: ConvertIo['shoot']
  audit?: FinishIo['audit']
}

export type ConvertFlags = {
  mode?: string; finish?: boolean; force?: boolean; 'no-install'?: boolean; 'no-baseline'?: boolean; start?: string; port?: string; config?: string
}

type Out = { out: (s: string) => void; err: (s: string) => void; cwd: string }

const MODES: readonly Mode[] = ['bilingual', 'arabic']
const MODE_QUESTION = 'One app that switches between English and Arabic, or a separate Arabic version? [bilingual/arabic]'
const NEXT_STEP = 'Fill the Arabic in dualkit-strings.json, or ask your agent to use the dualkit-convert skill, then run dualkit convert --finish.'
const NO_START = 'No start command, so the English baseline is skipped.'
const MAX_PORT = 65_535

const loadApi = async (): Promise<ConvertApi> => {
  const m = await import('@dualkit/convert')
  return { convert: m.convert, finish: m.finish, refusals: [m.RefusedError, m.UnsupportedError] }
}

const parsePort = (value: string, label: string): number => {
  const n = Number(value)
  if (value.trim() === '' || !Number.isInteger(n) || n < 1 || n > MAX_PORT) throw new UserError(`${label} must be a whole number from 1 to ${MAX_PORT}, got "${value}".`)
  return n
}

async function chooseMode(flags: ConvertFlags, env: ConvertEnv, interactive: boolean): Promise<Mode> {
  const given = flags.mode ?? (interactive ? await (env.ask ?? askOnTerminal)(MODE_QUESTION) : undefined)
  if (given === undefined) throw new UserError('Pass --mode bilingual or --mode arabic.')
  const mode = MODES.find((m) => m === given.trim().toLowerCase())
  if (!mode) throw new UserError(`${flags.mode === undefined ? 'The answer' : '--mode'} must be bilingual or arabic, got "${given}".`)
  return mode
}

/** Reads the config file, adds the convert answers and writes it back with 2-space indentation. Other keys stay as they are. */
export function saveConvertAnswers(file: string, answers: ConvertConfig): void {
  let existing: Record<string, unknown> = {}
  if (existsSync(file)) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) existing = parsed as Record<string, unknown>
    } catch {
      throw new UserError(`${file} is not valid JSON.`)
    }
  }
  const block = typeof existing.convert === 'object' && existing.convert !== null && !Array.isArray(existing.convert) ? existing.convert : {}
  writeFileSync(file, `${JSON.stringify({ ...existing, convert: { ...block, ...answers } }, null, 2)}\n`)
}

/** The convert settings after flags, asking once for a missing start command and port and saving the answers. */
async function settingsFor(flags: ConvertFlags, config: Config, env: ConvertEnv, interactive: boolean, io: Out): Promise<ConvertConfig> {
  const fromFlags: ConvertConfig = { ...(flags.start !== undefined ? { start: flags.start } : {}), ...(flags.port !== undefined ? { port: parsePort(flags.port, '--port') } : {}) }
  const merged: ConvertConfig = { ...config.convert, ...fromFlags }
  if (merged.start || !interactive || flags['no-baseline']) return merged
  const ask = env.ask ?? askOnTerminal
  const start = await ask('Command that starts your app, for example "npm run dev" (leave empty to skip the English baseline):')
  if (start === '') return merged
  const portAnswer = merged.port === undefined ? await ask('Port it listens on (leave empty for the default):') : ''
  const answers: ConvertConfig = { start, ...(portAnswer === '' ? {} : { port: parsePort(portAnswer, 'The port') }) }
  saveConvertAnswers(flags.config ?? join(io.cwd, 'dualkit.config.json'), answers)
  return { ...merged, ...answers }
}

function printSummary(summary: ConvertSummary, io: Out): void {
  const open = summary.flags.filter((f) => f.kind !== 'info').length
  io.out(`Branch: ${summary.branch}\n`)
  io.out(`${summary.filesChanged} files changed, ${summary.edits} edits, ${summary.strings} strings to translate, ${open} places left for you.\n\n${NEXT_STEP}\n`)
}

/** Runs dualkit convert and returns the exit code: 0 pass or phase 1 done, 1 finish failed, 2 refused, 130 interrupted. */
export async function runConvert(flags: ConvertFlags, io: Out, env: ConvertEnv = {}): Promise<number> {
  const interactive = env.interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY)
  let refusals: ConvertApi['refusals'] = []
  try {
    // Every flag and config field is checked before anything touches the repo or a browser.
    const finishing = Boolean(flags.finish)
    const mode = finishing ? undefined : await chooseMode(flags, env, interactive)
    if (finishing && flags.mode !== undefined && !MODES.some((m) => m === flags.mode)) throw new UserError(`--mode must be bilingual or arabic, got "${flags.mode}".`)
    const config = loadConfig(flags.config, io.cwd)
    const settings = await settingsFor(flags, config, env, interactive, io)
    const api = env.api ?? await loadApi()
    refusals = api.refusals
    const baseline = !flags['no-baseline'] && Boolean(settings.start)
    if (!finishing && !flags['no-baseline'] && !settings.start) io.out(`${NO_START}\n`)
    return await withInterrupt(async (signal) => {
      const kit = env.shoot || env.audit ? null : makeBrowserKit(settings, config, io.cwd, signal)
      const base: ConvertIo = {
        log: (s) => io.out(`${s}\n`), config: settings, run: env.run ?? ((cmd, cwd) => runCommand(cmd, cwd, signal)),
        ...((finishing || baseline) && (env.shoot ?? kit?.shoot) ? { shoot: (env.shoot ?? kit?.shoot) as NonNullable<ConvertIo['shoot']> } : {}),
      }
      try {
        if (!finishing) {
          printSummary(await api.convert({ root: io.cwd, mode: mode as Mode, install: !flags['no-install'], baseline }, base), io)
          return 0
        }
        const audit = env.audit ?? kit?.audit as FinishIo['audit']
        const lint = env.lint ?? (async (root: string) => (await (await import('@dualkit/lint')).lint(['.'], { cwd: root, ignore: config.ignore })).findings.length)
        const { reportPath, passed } = await api.finish({ root: io.cwd, ...(flags.force ? { force: true } : {}) }, { ...base, audit, lint })
        io.out(`Report: ${reportPath}\n${passed ? 'Passed.' : 'Failed. The report lists what to fix.'}\n`)
        return passed ? 0 : 1
      } finally {
        await kit?.close()
      }
    })
  } catch (e) {
    if (e instanceof InterruptedError) { io.err('Interrupted.\n'); return e.code }
    if (e instanceof UserError || refusals.some((R) => e instanceof R)) { io.err(`${(e as Error).message}\n`); return 2 }
    const message = e instanceof Error ? e.message.split('\n')[0] : String(e)
    io.err(`Something went wrong: ${message}\nRun with DEBUG=dualkit for details.\n`)
    if (process.env.DEBUG?.includes('dualkit') && e instanceof Error && e.stack) io.err(`${e.stack}\n`)
    return 1
  }
}
