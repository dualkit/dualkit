import { mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export const MAX_RECENT = 10
const ERROR_CHARS = 80

export type RecentBuild = {
  at: string; model: string; label: string; by: string; mark: string; screen: string; screenTitle: string
  condition: 'alone' | 'dualkit' | 'loop'; ok: boolean; rulesPassed: number | null; error: string | null
}
export type Progress = { month: string; running: boolean; total: number; done: number; updatedAt: string; recent: RecentBuild[] }
type Input = { month: string; running: boolean; total: number; done: number; updatedAt: string; /** Builds this run finished, oldest first. */ finished: readonly RecentBuild[] }

/** The progress file's contents: the last 10 finished builds, newest first, with errors clipped. */
export const progressOf = ({ finished, ...rest }: Input): Progress => ({
  ...rest,
  recent: finished.slice(-MAX_RECENT).reverse().map((b) => ({ ...b, error: b.error === null ? null : b.error.slice(0, ERROR_CHARS) })),
})

/** Writes snapshots one at a time, in the order they were handed over, each through a temp file and a rename so a reader never sees half a file. A failed write is reported, not thrown. */
export function makeProgressWriter(file: string, onError: (message: string) => void = () => {}) {
  let queue: Promise<void> = Promise.resolve()
  let closed = false
  return (snapshot: Progress): Promise<void> => {
    // Once the final (not running) snapshot is queued, nothing may flip the file back to running.
    if (closed) return queue
    if (!snapshot.running) closed = true
    const body = `${JSON.stringify(snapshot, null, 2)}\n`
    queue = queue.then(() => {
      try {
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(`${file}.tmp`, body)
        renameSync(`${file}.tmp`, file)
      } catch (e) {
        onError(`Could not write ${file}: ${e instanceof Error ? e.message : String(e)}`)
      }
    })
    return queue
  }
}
