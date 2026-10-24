import type { ConfigAnswers, ConvertConfig, ConvertIo, ConvertOptions, ConvertSummary, Mode, FinishIo } from '@dualkit/convert'
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
  ask?: (question: string, signal?: AbortSignal) => Promise<string>
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

type Ask = (question: string) => Promise<string>

async function chooseMode(flags: ConvertFlags, ask: Ask, interactive: boolean): Promise<Mode> {
  const given = flags.mode ?? (interactive ? await ask(MODE_QUESTION) : undefined)
  if (given === undefined) throw new UserError('Pass --mode bilingual or --mode arabic.')
  const mode = MODES.find((m) => m === given.trim().toLowerCase())
  if (!mode) throw new UserError(`${flags.mode === undefined ? 'The answer' : '--mode'} must be bilingual or arabic, got "${given}".`)
  return mode
}

/** The convert settings after flags, and the answers to save when a missing start command and port were asked for. */
async function settingsFor(flags: ConvertFlags, config: Config, ask: Ask, interactive: boolean): Promise<{ settings: ConvertConfig; answers?: ConfigAnswers }> {
  const fromFlags: ConvertConfig = { ...(flags.start !== undefined ? { start: flags.start } : {}), ...(flags.port !== undefined ? { port: parsePort(flags.port, '--port') } : {}) }
  const merged: ConvertConfig = { ...config.convert, ...fromFlags }
  if (merged.start || !interactive || flags['no-baseline']) return { settings: merged }
  const start = await ask('Command that starts your app, for example "npm run dev" (leave empty to skip the English baseline):')
  if (start === '') return { settings: merged }
  const portAnswer = merged.port === undefined ? await ask('Port it listens on (leave empty for the default):') : ''
  const answers: ConfigAnswers = { start, ...(portAnswer === '' ? {} : { port: parsePort(portAnswer, 'The port') }) }
  return { settings: { ...merged, ...answers }, answers }
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

function printSummary(summary: ConvertSummary, io: Out): void {
  const open = summary.flags.filter((f) => f.kind !== 'info').length
  io.out(`Branch: ${summary.branch}\n`)
  io.out(`${plural(summary.filesChanged, 'file', 'files')} changed, ${plural(summary.edits, 'edit', 'edits')}, ${plural(summary.strings, 'string', 'strings')} to translate, ${plural(open, 'place', 'places')} left for you.\n\n${NEXT_STEP}\n`)
}

/** Runs dualkit convert and returns the exit code: 0 pass or phase 1 done, 1 finish failed, 2 refused, 130 interrupted. */
export async function runConvert(flags: ConvertFlags, io: Out, env: ConvertEnv = {}): Promise<number> {
  const interactive = env.interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY)
  let refusals: ConvertApi['refusals'] = []
  try {
    // Prompts, flag checks and the run all sit inside the interrupt scope, so Ctrl-C at a prompt exits 130 too.
    return await withInterrupt(async (signal) => {
      const aborted = new Promise<never>((_, reject) => signal.addEventListener('abort', () => reject(new InterruptedError('Interrupted.')), { once: true }))
      aborted.catch(() => {})
      const ask: Ask = (q) => Promise.race([(env.ask ?? askOnTerminal)(q, signal), aborted])
      const finishing = Boolean(flags.finish)
      if (finishing && flags.mode !== undefined && !MODES.some((m) => m === flags.mode)) throw new UserError(`--mode must be bilingual or arabic, got "${flags.mode}".`)
      const mode = finishing ? undefined : await chooseMode(flags, ask, interactive)
      const config = loadConfig(flags.config, io.cwd)
      const { settings, answers } = await settingsFor(flags, config, ask, interactive)
      const api = env.api ?? await loadApi()
      refusals = api.refusals
      const baseline = !flags['no-baseline'] && Boolean(settings.start)
      if (!finishing && !flags['no-baseline'] && !settings.start) io.out(`${NO_START}\n`)
      const kit = env.shoot || env.audit ? null : makeBrowserKit(settings, config, io.cwd, signal)
      const base: ConvertIo = {
        log: (s) => io.out(`${s}\n`), config: settings, run: env.run ?? ((cmd, cwd) => runCommand(cmd, cwd, signal)),
        ...((finishing || baseline) && (env.shoot ?? kit?.shoot) ? { shoot: (env.shoot ?? kit?.shoot) as NonNullable<ConvertIo['shoot']> } : {}),
      }
      // The answers go to convert and finish, which commit them. The CLI never writes the config file itself.
      const configAnswers = answers ? { configAnswers: answers } : {}
      try {
        if (!finishing) {
          printSummary(await api.convert({ root: io.cwd, mode: mode as Mode, install: !flags['no-install'], baseline, ...configAnswers }, base), io)
          return 0
        }
        const audit = env.audit ?? kit?.audit as FinishIo['audit']
        const lint = env.lint ?? (async (root: string) => (await (await import('@dualkit/lint')).lint(['.'], { cwd: root, ignore: config.ignore })).findings.length)
        const { reportPath, passed } = await api.finish({ root: io.cwd, ...(flags.force ? { force: true } : {}), ...configAnswers }, { ...base, audit, lint })
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
