import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RULES } from '@dualkit/rules'

export type Config = { ignore: string[]; exclude: string[] }

/** A problem the person can fix. The CLI prints its message and exits 2, never a stack trace. */
export class UserError extends Error {}

const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')

export function loadConfig(path?: string, cwd = process.cwd()): Config {
  const file = path ?? join(cwd, 'dualkit.config.json')
  if (!existsSync(file)) {
    if (path) throw new UserError(`Could not find the config file ${path}.`)
    return { ignore: [], exclude: [] }
  }
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    throw new UserError(`${file} is not valid JSON.`)
  }
  const { ignore = [], exclude = [] } = (raw ?? {}) as Record<string, unknown>
  if (!isStringList(ignore)) throw new UserError('ignore must be a list of rule ids, for example ["type/arabic-size"].')
  if (!isStringList(exclude)) throw new UserError('exclude must be a list of CSS selectors, for example [".ads"].')
  const known = new Set(RULES.map((r) => r.id))
  const unknown = ignore.find((id) => !known.has(id))
  if (unknown) throw new UserError(`Unknown rule "${unknown}" in ignore. The rule ids are listed in https://github.com/dualkit/dualkit/blob/main/packages/rules/RULES.md`)
  return { ignore, exclude }
}
