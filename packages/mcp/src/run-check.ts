import { Worker } from 'node:worker_threads'
import type { CheckedFinding } from './check-core'

/**
 * The built package puts check-worker.js next to the bundle that imports this. Under the tests this file is still
 * TypeScript, so the worker is the .ts source, loaded through tsx.
 */
const FROM_SOURCE = import.meta.url.endsWith('.ts')
const WORKER_URL = new URL(FROM_SOURCE ? './check-worker.ts' : './check-worker.js', import.meta.url)
const WORKER_ARGV = FROM_SOURCE ? ['--import', 'tsx'] : []

export type CheckOutcome =
  | { kind: 'done'; findings: CheckedFinding[] }
  | { kind: 'timeout' }
  | { kind: 'cancelled' }
  | { kind: 'failed'; detail: string }

type Message = { findings: CheckedFinding[] } | { error: string }

/**
 * Checks the HTML in its own worker thread, so the server keeps answering while jsdom reads a large page. The worker
 * is stopped when the time runs out or the call is cancelled, and every outcome resolves: this never rejects.
 */
export function runCheck(html: string, timeoutMs: number, signal?: AbortSignal): Promise<CheckOutcome> {
  if (signal?.aborted) return Promise.resolve({ kind: 'cancelled' })
  return new Promise((resolve) => {
    const worker = new Worker(WORKER_URL, { workerData: { html }, execArgv: WORKER_ARGV })
    let settled = false
    const settle = (outcome: CheckOutcome) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      void worker.terminate()
      resolve(outcome)
    }
    const onAbort = () => settle({ kind: 'cancelled' })
    const timer = setTimeout(() => settle({ kind: 'timeout' }), timeoutMs)
    signal?.addEventListener('abort', onAbort, { once: true })
    worker.once('message', (message: Message) => {
      settle('findings' in message ? { kind: 'done', findings: message.findings } : { kind: 'failed', detail: message.error })
    })
    worker.once('error', (error) => settle({ kind: 'failed', detail: error.stack ?? error.message }))
    worker.once('exit', (code) => settle({ kind: 'failed', detail: `The check worker exited with code ${code} before it answered` }))
  })
}
