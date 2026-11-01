import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
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

const flagCount = (output: string): number => Number(/(\d+) (?:things?|items?|flags?) (?:left|to)/.exec(output)?.[1] ?? 0)

/** Runs convert phase 1 on one app. A failure is a result, never a thrown error, so one app cannot stop the suite. */
export function runApp(app: App, cache: string, cli: string): AppResult {
  const base = { id: app.id, repo: app.repo, commit: app.commit, framework: app.framework }
  const started = Date.now()
  const finish = (rest: Pick<AppResult, 'outcome' | 'detail' | 'strings' | 'missed' | 'flags'>): AppResult =>
    ({ ...base, ...rest, seconds: Math.round((Date.now() - started) / 1000) })
  try {
    const root = checkout(app, cache)
    const run = spawnSync('node', [cli, 'convert', '--mode', 'bilingual', '--no-install', '--no-baseline'], {
      cwd: root, encoding: 'utf8', timeout: 300_000, env: { ...process.env, CI: '1' },
    })
    const output = `${run.stdout ?? ''}${run.stderr ?? ''}`
    if (run.status !== 0) {
      return finish({ outcome: run.status === null ? 'crashed' : 'refused', detail: output.trim().split('\n').slice(-3).join(' ').slice(0, 300), strings: 0, missed: 0, flags: 0 })
    }
    return finish({ outcome: 'converted', detail: '', strings: ledgerSize(root), missed: countMissed(root), flags: flagCount(output) })
  } catch (error) {
    return finish({ outcome: 'crashed', detail: (error as Error).message.slice(0, 300), strings: 0, missed: 0, flags: 0 })
  }
}
