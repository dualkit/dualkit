import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ConvertState } from './types'

/** The folder convert keeps its own files in. Only the state and summary files in it are tracked. */
export const STATE_DIR = '.dualkit'
export const STATE_FILE = `${STATE_DIR}/convert.json`

function isState(value: unknown): value is ConvertState {
  if (!value || typeof value !== 'object') return false
  const s = value as Record<string, unknown>
  return ['mode', 'base', 'branch', 'framework'].every((k) => typeof s[k] === 'string')
    && typeof s.phase === 'string' && Array.isArray(s.generated) && s.generated.every((p) => typeof p === 'string')
}

/** The saved state, or null when there is none. Throws when the file is there but malformed. */
export function readState(root: string): ConvertState | null {
  const path = join(root, STATE_FILE)
  if (!existsSync(path)) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(`${STATE_FILE} is not valid JSON: ${(error as Error).message}`)
  }
  if (!isState(parsed)) throw new Error(`${STATE_FILE} is missing its mode, base, branch, framework, phase or generated files.`)
  return parsed
}

/** The state as 2-space JSON with a trailing newline. */
export const stateText = (state: ConvertState): string => JSON.stringify(state, null, 2) + '\n'

/** Writes the state file. */
export function saveState(root: string, state: ConvertState): void {
  mkdirSync(join(root, STATE_DIR), { recursive: true })
  writeFileSync(join(root, STATE_FILE), stateText(state))
}
