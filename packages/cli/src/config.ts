import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RULES as LINT_RULES } from '@dualkit/lint'
import { RULES } from '@dualkit/rules'
import type { ConvertConfig } from '@dualkit/convert'

export type Config = { ignore: string[]; exclude: string[]; convert?: ConvertConfig }

/** A problem the person can fix. The CLI prints its message and exits 2, never a stack trace. */
export class UserError extends Error {}

const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')

const MAX_PORT = 65_535
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Reads the convert block. Each bad field gives a one-line error that names it. */
export function parseConvert(raw: unknown): ConvertConfig {
  if (!isRecord(raw)) throw new UserError('convert must be an object, for example {"start": "npm run dev", "port": 3000}.')
  const { start, port, test, routes, params, storageState } = raw
  const out: ConvertConfig = {}
  if (start !== undefined) { if (!isText(start)) throw new UserError('convert.start must be a command, for example "npm run dev".'); out.start = start }
  if (port !== undefined) {
    if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > MAX_PORT) throw new UserError(`convert.port must be a whole number from 1 to ${MAX_PORT}.`)
    out.port = port
  }
  if (test !== undefined) { if (!isText(test)) throw new UserError('convert.test must be a command, for example "npm test".'); out.test = test }
  if (routes !== undefined) {
    if (!isStringList(routes)) throw new UserError('convert.routes must be a list of paths, for example ["/", "/pricing"].')
    out.routes = routes
  }
  if (params !== undefined) {
    if (!isRecord(params) || !Object.values(params).every((v) => typeof v === 'string')) throw new UserError('convert.params must map a dynamic route to a sample path, for example {"/orders/[id]": "/orders/42"}.')
    out.params = params as Record<string, string>
  }
  if (storageState !== undefined) {
    if (!isText(storageState)) throw new UserError('convert.storageState must be the path of a Playwright storage state file.')
    out.storageState = storageState
  }
  return out
}

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
  if (!isRecord(raw)) throw new UserError(`${file} must hold a JSON object.`)
  const { ignore = [], exclude = [], convert } = raw
  if (!isStringList(ignore)) throw new UserError('ignore must be a list of rule ids, for example ["type/arabic-size"].')
  if (!isStringList(exclude)) throw new UserError('exclude must be a list of CSS selectors, for example [".ads"].')
  // ignore names ids from both registries; each command skips the ids it does not run.
  const known = new Set([...RULES, ...LINT_RULES].map((r) => r.id))
  const unknown = ignore.find((id) => !known.has(id))
  if (unknown) throw new UserError(`Unknown rule "${unknown}" in ignore. The rule ids are listed in https://github.com/dualkit/dualkit/blob/main/packages/rules/RULES.md and https://github.com/dualkit/dualkit/blob/main/packages/lint/LINT.md`)
  return convert === undefined ? { ignore, exclude } : { ignore, exclude, convert: parseConvert(convert) }
}
