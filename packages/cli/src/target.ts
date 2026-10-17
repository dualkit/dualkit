import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { UserError } from './config'

/** Two or more characters, so a Windows drive such as C:\page.html is a path, not a scheme. */
const URL_SCHEME = /^[a-z][a-z0-9+.-]+:/i

export function toUrl(target: string, cwd = process.cwd()): string {
  const path = resolve(cwd, target)
  if (!URL_SCHEME.test(target) && existsSync(path)) return pathToFileURL(path).href
  let url: URL
  try {
    url = new URL(target)
  } catch {
    throw new UserError(`"${target}" is not a URL or a file. Use http, https or a local HTML file.`)
  }
  if (!['http:', 'https:', 'file:'].includes(url.protocol)) throw new UserError(`"${target}" is not supported. Use http, https or a local HTML file.`)
  return url.href
}
