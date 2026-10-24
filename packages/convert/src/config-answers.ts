import { writeText, readText, type Disk } from './apply'
import { RefusedError } from './git'
import type { ConfigAnswers } from './types'

export const CONFIG_FILE = 'dualkit.config.json'

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** The config file after the answers are merged into its `convert` block. Every other key is kept. Throws RefusedError when the file is not an object. */
export function mergedConfigText(before: string | null, answers: ConfigAnswers): string {
  let current: Record<string, unknown> = {}
  if (before !== null) {
    let parsed: unknown
    try { parsed = JSON.parse(before) } catch { throw new RefusedError(`${CONFIG_FILE} is not valid JSON, so convert did not save your answers.`) }
    if (!isObject(parsed)) throw new RefusedError(`${CONFIG_FILE} must hold a JSON object, so convert did not save your answers.`)
    current = parsed
  }
  const block = isObject(current.convert) ? current.convert : {}
  return `${JSON.stringify({ ...current, convert: { ...block, ...answers } }, null, 2)}\n`
}

/** Checks the config file can take the answers, without writing. Run before anything changes. */
export function checkConfigAnswers(root: string): void {
  mergedConfigText(readText(root, CONFIG_FILE), {})
}

/** Merges the answers into the config file on disk. Returns true when the file changed. A new file is recorded in disk.created for rollback. */
export function writeConfigAnswers(disk: Disk, answers: ConfigAnswers): boolean {
  return writeText(disk, CONFIG_FILE, mergedConfigText(readText(disk.root, CONFIG_FILE), answers))
}
