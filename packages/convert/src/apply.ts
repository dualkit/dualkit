import { parseSourceOutcome } from '@dualkit/lint'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { applyEdits } from './edits'
import { dualkitCss, importEdit, stylesheetPath } from './generate/stylesheet'
import { moveFile } from './git'
import { LEDGER_FILE, mergeLedger, messagesFor, readLedger, writeLedger, type LedgerEntry } from './ledger'
import { STATE_DIR } from './state'
import type { Plan, Project } from './types'

/** What a step changed on disk: root-relative paths to stage, and how many edits it applied. */
export type Applied = { touched: string[]; edits: number }

export const MESSAGES_DIR = 'messages'
export const messagesPath = (locale: 'en' | 'ar'): string => `${MESSAGES_DIR}/${locale}.json`

export const readText = (root: string, rel: string): string | null =>
  existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : null

/** Writes text at a root-relative path, creating folders. Returns false and writes nothing when the bytes are already the same. */
export function writeText(root: string, rel: string, text: string): boolean {
  if (readText(root, rel) === text) return false
  mkdirSync(dirname(join(root, rel)), { recursive: true })
  writeFileSync(join(root, rel), text)
  return true
}

/** Applies a wiring plan: moves with git mv, then writes, then edits keyed by post-move paths. */
export async function applyPlan(root: string, plan: Plan): Promise<Applied> {
  const touched: string[] = []
  for (const [from, to] of plan.moves) {
    await moveFile(root, from, to)
    touched.push(to)
  }
  for (const [path, text] of Object.entries(plan.writes)) {
    if (writeText(root, path, text)) touched.push(path)
  }
  let edits = 0
  for (const [path, list] of Object.entries(plan.edits)) {
    const text = readText(root, path)
    if (text === null) throw new Error(`Convert planned edits to ${path}, but the file is not there.`)
    if (writeText(root, path, applyEdits(text, list))) touched.push(path)
    edits += list.length
  }
  return { touched, edits }
}

/** Writes dualkit.css and imports it in the entry file, which is read at its post-move path. */
export function addStylesheet(root: string, project: Project, entry: string): Applied {
  const css = stylesheetPath(project)
  const touched = writeText(root, css, dualkitCss(project)) ? [css] : []
  const text = readText(root, entry)
  if (text === null) throw new Error(`Convert could not read the entry file ${entry}.`)
  const outcome = parseSourceOutcome(entry, text, join(root, entry))
  if ('error' in outcome) throw new Error(`The entry file ${entry} does not parse after wiring: ${outcome.error}`)
  const edit = importEdit(outcome.file, css)
  if (!edit) return { touched, edits: 0 }
  writeText(root, entry, applyEdits(outcome.file.text, [edit]))
  return { touched: [...touched, entry], edits: 1 }
}

const json = (value: unknown): string => JSON.stringify(value, null, 2) + '\n'

/** Merges new entries into the ledger and writes both messages files from it. Existing entries keep their Arabic. */
export function writeStrings(root: string, added: LedgerEntry[]): Applied & { ledger: LedgerEntry[] } {
  const before = readText(root, LEDGER_FILE)
  const ledger = mergeLedger(readLedger(root), added)
  writeLedger(root, ledger)
  const touched = readText(root, LEDGER_FILE) === before ? [] : [LEDGER_FILE]
  for (const locale of ['en', 'ar'] as const) {
    if (writeText(root, messagesPath(locale), json(messagesFor(ledger, locale)))) touched.push(messagesPath(locale))
  }
  return { touched, edits: 0, ledger }
}

/** Adds each dependency the app does not already declare to package.json, keeping its indent. Returns whether it changed. */
export function addDependencies(root: string, deps: Record<string, string>): boolean {
  const text = readText(root, 'package.json')
  if (text === null) throw new Error('Convert could not read package.json.')
  const pkg = JSON.parse(text) as Record<string, Record<string, string> | undefined>
  const declared = { ...pkg.devDependencies, ...pkg.peerDependencies, ...pkg.dependencies }
  const missing = Object.entries(deps).filter(([name]) => !(name in declared))
  if (missing.length === 0) return false
  const dependencies = Object.fromEntries([...Object.entries(pkg.dependencies ?? {}), ...missing].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
  const indent = /^([ \t]+)"/m.exec(text)?.[1] ?? '  '
  return writeText(root, 'package.json', JSON.stringify({ ...pkg, dependencies }, null, indent) + '\n')
}

/** Adds the state folder to the app's .gitignore. Returns whether it changed. */
export function ignoreStateDir(root: string): boolean {
  const text = readText(root, '.gitignore') ?? ''
  const lines = text.split(/\r?\n/).map((l) => l.trim())
  if (lines.includes(`${STATE_DIR}/`) || lines.includes(STATE_DIR) || lines.includes(`/${STATE_DIR}/`)) return false
  const gap = text === '' || text.endsWith('\n') ? '' : '\n'
  return writeText(root, '.gitignore', `${text}${gap}${STATE_DIR}/\n`)
}
