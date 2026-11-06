import { parentPort, workerData } from 'node:worker_threads'
import { checkMarkup } from './check-core'

/** One check per worker: the thread reads the page, posts the findings and ends, and its jsdom window goes with it. */
const { html } = workerData as { html: string }
try {
  parentPort?.postMessage({ findings: checkMarkup(html) })
} catch (error) {
  parentPort?.postMessage({ error: error instanceof Error ? (error.stack ?? error.message) : String(error) })
}
