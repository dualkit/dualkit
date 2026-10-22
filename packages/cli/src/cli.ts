import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { lint } from '@dualkit/lint'
import type { audit } from './audit'
import { UserError, loadConfig } from './config'
import { formatLint, formatSkipped, isFailOn, shouldFail } from './lint'
import { renderReport } from './report'
import { review, type ReviewResult, type Vision } from './review'
import { DEFAULT_REVIEW_MODEL, makeVision, type VisionModel } from './review/model'
import { formatReview, formatSummary } from './summary'
import { toUrl } from './target'

export type Io = { out: (s: string) => void; err: (s: string) => void; write: (path: string, data: string) => void; audit: typeof audit; lint?: typeof lint; vision?: Vision; cwd: string }

const HELP = `Usage: dualkit check <url or file> [options]
       dualkit lint [paths...] [options]

  --out <file>        Report path (default dualkit-report.html)
  --json              Print the result as JSON instead of the summary
  --width <px>        Viewport width (default 1280)
  --height <px>       Viewport height (default 800)
  --min-score <n>     Exit 1 when the score is below n
  --config <file>     Config file (default dualkit.config.json)
  --review            Experimental. Ask a vision model for problems the rules cannot see (needs GEMINI_API_KEY)
  --review-model <provider:model>
                      Model for --review, gemini or openrouter (default gemini:gemini-flash-lite-latest)

dualkit lint scans source files (CSS, SCSS, HTML, Vue, Svelte, JS, TS, JSX, TSX) and needs no browser:

  --json              Print the result as JSON instead of the list
  --fail-on <level>   Exit 1 on findings at or above error, warning or note (default error)
  --config <file>     Config file (default dualkit.config.json)

Check rules: https://github.com/dualkit/dualkit/blob/main/packages/rules/RULES.md
Lint rules: https://github.com/dualkit/dualkit/blob/main/packages/lint/LINT.md
`

const defaultIo: Io = {
  out: (s) => process.stdout.write(s), err: (s) => process.stderr.write(s),
  write: (p, d) => writeFileSync(p, d),
  // Lazy, so `dualkit lint` never loads Playwright.
  audit: async (o) => (await import('./audit')).audit(o), cwd: process.cwd(),
}

const int = (name: string, value: string | undefined, fallback: number, min: number): number => {
  if (value === undefined) return fallback
  const n = Number(value)
  if (value.trim() === '' || !Number.isInteger(n) || n < min) {
    throw new UserError(`--${name} must be a whole number of at least ${min}, got "${value}".`)
  }
  return n
}

/** Flags that only dualkit check reads. dualkit lint rejects them rather than ignore them. */
const CHECK_ONLY = ['out', 'width', 'height', 'min-score', 'review-model'] as const

type LintValues = { json?: boolean; review?: boolean; 'fail-on'?: string; config?: string } & Partial<Record<(typeof CHECK_ONLY)[number], string>>

async function runLint(paths: string[], values: LintValues, io: Io): Promise<number> {
  const checkOnly = CHECK_ONLY.find((name) => values[name] !== undefined)
  if (checkOnly) throw new UserError(`--${checkOnly} is a dualkit check option. dualkit lint does not take it.`)
  if (values.review) throw new UserError('--review is a dualkit check option. dualkit lint does not take it.')
  const failOn = values['fail-on'] ?? 'error'
  if (!isFailOn(failOn)) throw new UserError(`--fail-on must be error, warning or note, got "${failOn}".`)
  const targets = paths.length > 0 ? paths : ['.']
  const missing = targets.find((p) => !existsSync(resolve(io.cwd, p)))
  if (missing !== undefined) throw new UserError(`Could not find ${missing}.`)
  const config = loadConfig(values.config, io.cwd)
  const result = await (io.lint ?? lint)(targets, { cwd: io.cwd, ignore: config.ignore })
  if (values.json) io.out(`${JSON.stringify(result)}\n`)
  else {
    io.out(formatLint(result, Boolean(process.stdout.isTTY)))
    const skipped = formatSkipped(result)
    if (skipped) io.err(skipped)
  }
  return shouldFail(result, failOn) ? 1 : 0
}

const PROVIDERS: readonly VisionModel['provider'][] = ['openrouter', 'gemini']

/** Reads provider:model, splitting at the first colon so model names such as "x/y:free" survive. */
export function parseReviewModel(value: string | undefined): VisionModel {
  if (value === undefined) return DEFAULT_REVIEW_MODEL
  const at = value.indexOf(':')
  const provider = value.slice(0, at)
  const model = value.slice(at + 1)
  const known = PROVIDERS.find((p) => p === provider)
  if (at < 0 || !known || model.trim() === '') {
    throw new UserError(`--review-model must look like provider:model, with provider gemini or openrouter, got "${value}".`)
  }
  return { provider: known, model }
}

/** The page source for a local file target, else null. A URL target has no source line to point at. */
function readSource(url: string): string | null {
  if (!url.startsWith('file:')) return null
  try {
    return readFileSync(fileURLToPath(url), 'utf8')
  } catch {
    return null
  }
}

/** Review is extra: whatever goes wrong in it, the check result, report and exit code stay as they were. */
async function safeReview(result: Awaited<ReturnType<typeof audit>>, url: string, io: Io, model: VisionModel): Promise<ReviewResult> {
  try {
    // The CLI runs on the user's own key, so it passes no spend cap or ledger. The total is still reported.
    return await review(result, { source: readSource(url), vision: io.vision ?? makeVision({ env: process.env }), model, log: (line) => io.err(`${line}\n`) })
  } catch (e) {
    return { findings: [], spentUsd: 0, skipped: `Review failed: ${e instanceof Error ? e.message : String(e)}`, unchecked: 0 }
  }
}

export async function run(argv: string[], io: Io = defaultIo): Promise<number> {
  try {
    const { values, positionals } = parseArgs({
      args: argv, allowPositionals: true,
      options: {
        out: { type: 'string' }, json: { type: 'boolean' }, width: { type: 'string' }, height: { type: 'string' },
        'min-score': { type: 'string' }, review: { type: 'boolean' }, 'review-model': { type: 'string' }, 'fail-on': { type: 'string' }, config: { type: 'string' }, help: { type: 'boolean', short: 'h' },
      },
    })
    if (values.help) { io.out(HELP); return 0 }
    const [command, target] = positionals
    if (command === 'lint') return await runLint(positionals.slice(1), values, io)
    if (command !== 'check' || !target) throw new UserError(`${command ? `Unknown command "${command}".` : 'Missing command.'}\n\n${HELP}`)
    // Validate every flag before the audit, so a typo fails in milliseconds, not after a browser run.
    const width = int('width', values.width, 1280, 1)
    const height = int('height', values.height, 800, 1)
    const min = int('min-score', values['min-score'], 0, 0)
    if (values['review-model'] !== undefined && !values.review) throw new UserError('--review-model only works together with --review.')
    const reviewModel = parseReviewModel(values['review-model'])
    const url = toUrl(target, io.cwd)
    const config = loadConfig(values.config, io.cwd)
    const result = await io.audit({ url, width, height, config })
    // The CLI runs on the user's own key, so it passes no spend cap or ledger. The total is still reported.
    const reviewed = values.review ? await safeReview(result, url, io, reviewModel) : null
    if (reviewed?.skipped) io.err(`Review skipped: ${reviewed.skipped}\n`)
    const out = resolve(io.cwd, values.out ?? 'dualkit-report.html')
    io.write(values.out ?? 'dualkit-report.html', renderReport(result, reviewed?.findings ?? []))
    const json = { ...result, screenshot: undefined, screen: undefined, report: out, ...(reviewed ? { review: reviewed } : {}) }
    io.out(values.json ? `${JSON.stringify(json)}\n` : `${formatSummary(result)}${reviewed ? formatReview(reviewed, Boolean(process.stdout.isTTY)) : ''}\nReport: ${out}\n`)
    return result.score < min ? 1 : 0
  } catch (e) {
    const message = e instanceof UserError || (e instanceof TypeError && 'code' in e) ? e.message : `Something went wrong: ${e instanceof Error ? e.message : String(e)}`
    io.err(`${message}\n`)
    return 2
  }
}

// npx runs the bin through a symlink, so compare real paths.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  // exitCode, not exit(): exiting would cut off --json output that is still being piped.
  run(process.argv.slice(2)).then((code) => { process.exitCode = code })
}
