import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { findEnglish } from './missed'
import type { AppResult } from './score'

export type App = { id: string; repo: string; commit: string; framework: string; root: string }

const SKIP = new Set(['node_modules', '.next', 'dist', 'build', '.git', 'public', 'messages', 'locales', 'test', 'tests', '__tests__'])
const git = (cwd: string, ...args: string[]): void => { execFileSync('git', args, { cwd, stdio: 'ignore' }) }

/** Fetches the pinned commit into a fresh folder, so every run starts from the same source. */
function checkout(app: App, cache: string): string {
  const dir = join(cache, app.id)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  git(dir, 'init', '-q')
  git(dir, 'remote', 'add', 'origin', `https://github.com/${app.repo}.git`)
  git(dir, 'fetch', '-q', '--depth', '1', 'origin', app.commit)
  git(dir, 'checkout', '-q', '-b', 'main', 'FETCH_HEAD')
  git(dir, 'config', 'user.name', 'dualkit proof')
  git(dir, 'config', 'user.email', 'proof@dualkit.invalid')
  return resolve(dir, app.root)
}

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return SKIP.has(entry.name) ? [] : sources(path)
    return /\.(tsx|jsx)$/.test(entry.name) && !/\.(test|spec|stories)\./.test(entry.name) ? [path] : []
  })
}

const countMissed = (root: string): number =>
  sources(root).reduce((n, file) => n + findEnglish(readFileSync(file, 'utf8'), file).length, 0)

const ledgerSize = (root: string): number => {
  const path = join(root, 'dualkit-strings.json')
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as unknown[]).length : 0
}

const flagCount = (root: string): number => {
  const path = join(root, '.dualkit/summary.json')
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as { flags: unknown[] }).flags.length : 0
}

/** Installs with the app's own package manager and lockfile, so versions match what the app was built against. */
function install(root: string): void {
  const has = (name: string): boolean => existsSync(join(root, name))
  const [command, ...args] = has('pnpm-lock.yaml') ? ['npx', '-y', 'pnpm@10', 'install', '--no-frozen-lockfile']
    : has('bun.lock') ? ['npx', '-y', 'bun@1', 'install']
      : has('yarn.lock') ? ['npx', '-y', 'yarn@1', 'install', '--silent']
        : ['npm', 'install', '--silent', '--no-audit', '--no-fund']
  spawnSync(command!, args, { cwd: root, timeout: 420_000, env: { ...process.env, CI: '' } })
}

/** Type errors in an app, one `file code` per line, so errors can be compared before and after by what they are. */
function typeErrors(root: string): string[] {
  install(root)
  rmSync(join(root, '.next'), { recursive: true, force: true })
  const config = existsSync(join(root, 'tsconfig.app.json')) ? 'tsconfig.app.json' : 'tsconfig.json'
  const run = spawnSync('npx', ['tsc', '--noEmit', '-p', config], { cwd: root, encoding: 'utf8', timeout: 300_000 })
  return (run.stdout ?? '').split('\n').flatMap((line) => {
    const hit = /^(.+?)\(\d+,\d+\): error (TS\d+)/.exec(line)
    return hit ? [`${hit[1]!.replace('[locale]/', '')} ${hit[2]}`] : []
  })
}

/** Stand-in settings, so an app can build and serve without real secrets. Pages that need the real service stay shut. */
const PLACEHOLDERS: Record<string, string> = {
  CI: '1', NEXT_TELEMETRY_DISABLED: '1', SKIP_ENV_VALIDATION: '1', DATABASE_URL: 'postgres://proof:proof@localhost:5432/proof', POSTGRES_URL: 'postgres://proof:proof@localhost:5432/proof', AUTH_SECRET: 'proof', NEXTAUTH_SECRET: 'proof', NEXT_PUBLIC_APP_URL: 'http://localhost:3000', STRIPE_SECRET_KEY: 'sk_test_proof', STRIPE_WEBHOOK_SECRET: 'whsec_proof',
  STRIPE_API_KEY: 'sk_test_proof', STRIPE_PRO_MONTHLY_PLAN_ID: 'price_proof', NEXTAUTH_URL: 'http://localhost:3000', BASE_URL: 'http://localhost:3000',
  GITHUB_CLIENT_ID: 'proof', GITHUB_CLIENT_SECRET: 'proof', GITHUB_ACCESS_TOKEN: 'proof', SMTP_FROM: 'proof@example.com',
  POSTMARK_API_TOKEN: 'proof', POSTMARK_SIGN_IN_TEMPLATE: 'proof', POSTMARK_ACTIVATION_TEMPLATE: 'proof',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from('proof.clerk.accounts.dev$').toString('base64')}`, CLERK_SECRET_KEY: 'sk_test_proof',
}

/** The app's own build script, with placeholder settings so a build does not need real secrets. */
function builds(root: string): { ok: boolean; tail: string } {
  const attempt = () => spawnSync('npm', ['run', 'build'], { cwd: root, encoding: 'utf8', timeout: 420_000, env: { ...process.env, ...PLACEHOLDERS } })
  const first = attempt()
  const run = first.status === 0 ? first : attempt()
  return { ok: run.status === 0, tail: `${run.stdout ?? ''}${run.stderr ?? ''}`.trim().split('\n').filter((l) => !/^\s+at /.test(l)).slice(-12).join(' ').slice(0, 500) }
}

// CI is cleared for next dev because recent Next versions quit at a security notice under CI, on apps pinned to an old release.
/** Each app gets its own port, so a server another app left behind cannot answer for this one. */
const proofPort = (app: App): string => String(3200 + ([...app.id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 700))
const startCommand = (app: App): string => (app.framework === 'next' ? `env -u CI npx next dev -p ${proofPort(app)}` : `npx vite --port ${proofPort(app)}`)

/** Fills the ledger with stand-in Arabic that keeps every placeholder and tag, so finish can run without a translator. */
export function standInArabic(en: string): string {
  const tags = [...en.matchAll(/<([a-z0-9]+)>(.*?)<\/\1>/g)].map((m) => `<${m[1]}>${m[2]}</${m[1]}>`)
  const rest = [...en.replace(/<([a-z0-9]+)>.*?<\/\1>/g, ' ').matchAll(/\{[^}]*\}/g)].map((m) => m[0])
  return ['نص عربي', ...tags, ...rest].join(' ')
}

/** Runs phase 2 on stand-in Arabic. Passed means English matched its baseline and the Arabic pages had no errors. */
function finishes(root: string, cli: string, app: App): { ok: boolean; tail: string } {
  const path = join(root, 'dualkit-strings.json')
  const entries = (JSON.parse(readFileSync(path, 'utf8')) as { en: string }[]).map((e) => ({ ...e, ar: standInArabic(e.en), status: 'drafted' }))
  writeFileSync(path, `${JSON.stringify(entries, null, 2)}\n`)
  const run = spawnSync('node', [cli, 'convert', '--finish', '--start', startCommand(app), '--port', proofPort(app)], {
    cwd: root, encoding: 'utf8', timeout: 1_800_000, env: { ...process.env, ...PLACEHOLDERS, CI: '1' },
  })
  const report = join(root, 'dualkit-convert.md')
  const failed = existsSync(report) ? readFileSync(report, 'utf8').split('\n').filter((l) => /: fail|[1-9]\d* errors?,|returned \d|Could not open|no result/.test(l)).slice(0, 4).join(' ') : ''
  return { ok: run.status === 0, tail: (failed || `${run.stdout ?? ''}${run.stderr ?? ''}`.trim().slice(-300)).slice(0, 400) }
}

/** Errors in `after` beyond those in `before`, counted per file and code, because convert shifts line numbers. */
export function newErrors(before: string[], after: string[]): number {
  const left = before.reduce((m, e) => m.set(e, (m.get(e) ?? 0) + 1), new Map<string, number>())
  return after.filter((e) => {
    const n = left.get(e) ?? 0
    left.set(e, n - 1)
    return n <= 0
  }).length
}

/** Runs convert phase 1 on one app. A failure is a result, never a thrown error, so one app cannot stop the suite. */
export function runApp(app: App, cache: string, cli: string, typecheck = false, build = false, phase2 = false): AppResult {
  const base = { id: app.id, repo: app.repo, commit: app.commit, framework: app.framework }
  const started = Date.now()
  const finish = (rest: Pick<AppResult, 'outcome' | 'detail' | 'strings' | 'missed' | 'flags'> & Partial<Pick<AppResult, 'typeErrors' | 'buildBefore' | 'buildAfter' | 'buildDetail' | 'finished' | 'finishDetail'>>): AppResult =>
    ({ ...base, ...rest, seconds: Math.round((Date.now() - started) / 1000) })
  try {
    const root = checkout(app, cache)
    const before = typecheck || build ? typeErrors(root) : []
    const buildBefore = build ? builds(root) : null
    if (typecheck || build) {
      git(root, 'add', '-A')
      git(root, 'commit', '-q', '--allow-empty', '--no-verify', '-m', 'dependencies')
    }
    const phase1 = phase2 ? ['--start', startCommand(app), '--port', proofPort(app)] : ['--no-install', '--no-baseline']
    const run = spawnSync('node', [cli, 'convert', '--mode', 'bilingual', ...phase1], {
      cwd: root, encoding: 'utf8', timeout: 1_800_000, env: { ...process.env, ...PLACEHOLDERS, CI: '1' },
    })
    const output = `${run.stdout ?? ''}${run.stderr ?? ''}`
    if (run.status !== 0) {
      return finish({ outcome: run.status === null ? 'crashed' : 'refused', detail: output.trim().split('\n').slice(-3).join(' ').slice(0, 300), strings: 0, missed: 0, flags: 0 })
    }
    const typed = typecheck ? { typeErrors: newErrors(before, typeErrors(root)) } : {}
    if (build && !typecheck) typeErrors(root)
    const buildAfter = build ? builds(root) : null
    const built = buildBefore && buildAfter
      ? { buildBefore: buildBefore.ok, buildAfter: buildAfter.ok, buildDetail: buildAfter.ok ? '' : buildAfter.tail }
      : {}
    const strings = ledgerSize(root)
    const missed = countMissed(root)
    const flags = flagCount(root)
    const done = phase2 ? finishes(root, cli, app) : null
    const phased = done ? { finished: done.ok, finishDetail: done.ok ? '' : done.tail } : {}
    return finish({ outcome: 'converted', detail: buildBefore && !buildBefore.ok ? buildBefore.tail : '', strings, missed, flags, ...typed, ...built, ...phased })
  } catch (error) {
    return finish({ outcome: 'crashed', detail: (error as Error).message.slice(0, 300), strings: 0, missed: 0, flags: 0 })
  }
}
