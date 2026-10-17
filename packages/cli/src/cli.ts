import { realpathSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { audit } from './audit'
import { UserError, loadConfig } from './config'
import { renderReport } from './report'
import { formatSummary } from './summary'
import { toUrl } from './target'

export type Io = { out: (s: string) => void; err: (s: string) => void; write: (path: string, data: string) => void; audit: typeof audit; cwd: string }

const HELP = `Usage: dualkit check <url or file> [options]

  --out <file>        Report path (default dualkit-report.html)
  --json              Print the result as JSON instead of the summary
  --width <px>        Viewport width (default 1280)
  --height <px>       Viewport height (default 800)
  --min-score <n>     Exit 1 when the score is below n
  --config <file>     Config file (default dualkit.config.json)

Rules: https://github.com/dualkit/dualkit/blob/main/packages/rules/RULES.md
`

const defaultIo: Io = {
  out: (s) => process.stdout.write(s), err: (s) => process.stderr.write(s),
  write: (p, d) => writeFileSync(p, d), audit, cwd: process.cwd(),
}

const int = (name: string, value: string | undefined, fallback: number, min: number): number => {
  if (value === undefined) return fallback
  const n = Number(value)
  if (value.trim() === '' || !Number.isInteger(n) || n < min) {
    throw new UserError(`--${name} must be a whole number of at least ${min}, got "${value}".`)
  }
  return n
}

export async function run(argv: string[], io: Io = defaultIo): Promise<number> {
  try {
    const { values, positionals } = parseArgs({
      args: argv, allowPositionals: true,
      options: {
        out: { type: 'string' }, json: { type: 'boolean' }, width: { type: 'string' }, height: { type: 'string' },
        'min-score': { type: 'string' }, config: { type: 'string' }, help: { type: 'boolean', short: 'h' },
      },
    })
    if (values.help) { io.out(HELP); return 0 }
    const [command, target] = positionals
    if (command !== 'check' || !target) throw new UserError(`${command ? `Unknown command "${command}".` : 'Missing command.'}\n\n${HELP}`)
    // Validate every flag before the audit, so a typo fails in milliseconds, not after a browser run.
    const width = int('width', values.width, 1280, 1)
    const height = int('height', values.height, 800, 1)
    const min = int('min-score', values['min-score'], 0, 0)
    const url = toUrl(target, io.cwd)
    const config = loadConfig(values.config, io.cwd)
    const result = await io.audit({ url, width, height, config })
    const out = resolve(io.cwd, values.out ?? 'dualkit-report.html')
    io.write(values.out ?? 'dualkit-report.html', renderReport(result))
    io.out(values.json ? `${JSON.stringify({ ...result, screenshot: undefined, report: out })}\n` : `${formatSummary(result)}\nReport: ${out}\n`)
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
