import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import type { Browser } from 'playwright'
import type { Shooter } from '@dualkit/convert'
import type { audit as auditPage, AuditResult } from './audit'
import { UserError, type Config } from './config'

const SHOT_HEIGHT = 900
const LOAD_TIMEOUT_MS = 30_000
const GRACE_MS = 10_000
const INTERRUPTED = 130
const MAX_OUTPUT = 200_000

// Browser-side global: the CLI tsconfig has no DOM lib.
declare const document: { fonts: { ready: Promise<unknown> } }

/** Thrown to the command when SIGINT or SIGTERM stopped the run. It exits 130. */
export class InterruptedError extends Error {
  readonly code = INTERRUPTED
}

/** One Chromium for a whole run. It starts on first use and `close` is safe to call more than once. */
export type BrowserKit = {
  shoot: Shooter
  audit: (url: string, width: number, options?: { cookies?: Record<string, string> }) => Promise<{ score: number; errors: number; warnings: number }>
  close: () => Promise<void>
}

/** Same browser, but `close` does nothing, so the audit function can reuse it. */
const unclosable = (browser: Browser): Browser => new Proxy(browser, { get: (t, k) => (k === 'close' ? async () => {} : Reflect.get(t, k, t)) })

export function makeBrowserKit(settings: { storageState?: string }, config: Config, cwd: string, signal: AbortSignal): BrowserKit {
  let browser: Promise<Browser> | null = null
  const storageState = settings.storageState ? resolve(cwd, settings.storageState) : undefined
  const launch = (): Promise<Browser> => {
    browser ??= import('playwright').then(({ chromium }) => chromium.launch()).catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e)
      throw new UserError(/Executable doesn't exist|playwright install/i.test(message) ? 'Chromium is not installed. Run: npx playwright@1.55.0 install chromium' : `Could not start Chromium: ${message.split('\n')[0]}`)
    })
    return browser
  }
  const stop = (): void => { void kit.close() }
  signal.addEventListener('abort', stop, { once: true })
  const kit: BrowserKit = {
    shoot: async (url, width, options) => {
      signal.throwIfAborted()
      const context = await (await launch()).newContext({
        viewport: { width, height: SHOT_HEIGHT }, reducedMotion: 'reduce', locale: 'en-US', timezoneId: 'Asia/Dubai', deviceScaleFactor: 1,
        ...(storageState ? { storageState } : {}),
      })
      try {
        if (options?.cookies) await context.addCookies(Object.entries(options.cookies).map(([name, value]) => ({ name, value, url })))
        const page = await context.newPage()
        await page.goto(url, { waitUntil: 'load', timeout: LOAD_TIMEOUT_MS })
        await page.evaluate(() => document.fonts.ready).catch(() => {})
        return await page.screenshot({ fullPage: true, animations: 'disabled', timeout: LOAD_TIMEOUT_MS })
      } finally {
        await context.close().catch(() => {})
      }
    },
    audit: async (url, width, options) => {
      signal.throwIfAborted()
      const { audit } = await import('./audit')
      const result: AuditResult = await (audit as typeof auditPage)(
        { url, width, height: SHOT_HEIGHT, config, ...(options?.cookies ? { cookies: options.cookies } : {}), ...(storageState ? { storageState } : {}) },
        async () => unclosable(await launch()),
      )
      const count = (severity: string): number => result.findings.filter((f) => f.severity === severity).length
      return { score: result.score, errors: count('error'), warnings: count('warning') }
    },
    close: async () => {
      const open = browser
      browser = null
      if (open) await (await open.catch(() => null))?.close().catch(() => {})
    },
  }
  return kit
}

/** Runs a shell command in cwd and keeps the tail of its output. It never rejects. */
export function runCommand(cmd: string, cwd: string, signal?: AbortSignal): Promise<{ code: number; out: string }> {
  return new Promise((done) => {
    let out = ''
    const child = spawn(cmd, { cwd, shell: true, stdio: ['ignore', 'pipe', 'pipe'], ...(signal ? { signal } : {}) })
    const keep = (chunk: Buffer): void => { out = (out + chunk.toString()).slice(-MAX_OUTPUT) }
    child.stdout.on('data', keep)
    child.stderr.on('data', keep)
    child.on('error', (e) => done({ code: 1, out: `${out}${e.message}\n` }))
    child.on('close', (code) => done({ code: code ?? 1, out }))
  })
}

/** Asks one question on the terminal and returns the trimmed answer. */
export async function askOnTerminal(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    return (await rl.question(`${question} `)).trim()
  } finally {
    rl.close()
  }
}

/**
 * Runs `work` with an AbortSignal that SIGINT and SIGTERM trigger. On a signal the browser is closed through the
 * signal, which makes the pending shot or audit reject, so convert and finish run their own `finally` blocks and stop the
 * app server. The run is then given a grace period to settle. A second signal gives up at once. Rejects with
 * InterruptedError, which the command turns into exit 130. The handlers are removed when the run ends.
 */
export function withInterrupt<T>(work: (signal: AbortSignal) => Promise<T>, grace = GRACE_MS): Promise<T> {
  const controller = new AbortController()
  return new Promise<T>((resolveRun, rejectRun) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const give = (): void => rejectRun(new InterruptedError('Interrupted.'))
    const onSignal = (): void => {
      if (controller.signal.aborted) return give()
      controller.abort()
      timer = setTimeout(give, grace)
    }
    process.on('SIGINT', onSignal)
    process.on('SIGTERM', onSignal)
    const settle = (): void => {
      clearTimeout(timer)
      process.off('SIGINT', onSignal)
      process.off('SIGTERM', onSignal)
    }
    work(controller.signal).then(
      (v) => { settle(); controller.signal.aborted ? give() : resolveRun(v) },
      (e: unknown) => { settle(); controller.signal.aborted ? give() : rejectRun(e) },
    )
  })
}
