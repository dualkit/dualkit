import { parseSourceOutcome } from '@dualkit/lint'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { applyEdits } from './edits'
import { dualkitCss, importEdit, stylesheetPath } from './generate/stylesheet'
import { moveFile } from './git'
import { LEDGER_FILE, messagesFor, writeLedger, type LedgerEntry } from './ledger'
import { STATE_DIR, STATE_FILE } from './state'
import { SUMMARY_FILE } from './summary'
import type { Plan, Project } from './types'

/** What a step changed on disk: root-relative paths to stage, and how many edits it applied. */
export type Applied = { touched: string[]; edits: number }
/** What applyPlan changed: paths, plus counts of only the writes and edits that changed a file. */
export type AppliedPlan = Applied & { writes: number; perFile: Record<string, number> }

export const MESSAGES_DIR = 'messages'
export const messagesPath = (locale: 'en' | 'ar'): string => `${MESSAGES_DIR}/${locale}.json`

export const readText = (root: string, rel: string): string | null =>
  existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : null

/** The app root, and every root-relative file and folder convert created there, so a failed run can remove them. */
export type Disk = { root: string; created: string[] }

/** Makes a root-relative folder and its parents, recording the topmost one that was new. */
export function ensureDir(disk: Disk, dir: string): void {
  const made = mkdirSync(join(disk.root, dir), { recursive: true })
  if (made) disk.created.push(relative(disk.root, made).split(sep).join('/'))
}

/** Writes text at a root-relative path, creating folders. Returns false and writes nothing when the bytes are already the same. */
export function writeText(disk: Disk, rel: string, text: string): boolean {
  const before = readText(disk.root, rel)
  if (before === text) return false
  ensureDir(disk, dirname(rel))
  writeFileSync(join(disk.root, rel), text)
  if (before === null) disk.created.push(rel)
  return true
}

/** Applies a wiring plan: moves with git mv, then writes, then edits keyed by post-move paths. */
export async function applyPlan(disk: Disk, plan: Plan): Promise<AppliedPlan> {
  const touched: string[] = []
  for (const [from, to] of plan.moves) {
    ensureDir(disk, dirname(to))
    await moveFile(disk.root, from, to)
    disk.created.push(to)
    touched.push(to)
  }
  let writes = 0
  for (const [path, text] of Object.entries(plan.writes)) {
    if (!writeText(disk, path, text)) continue
    touched.push(path)
    writes += 1
  }
  let edits = 0
  const perFile: Record<string, number> = {}
  for (const [path, list] of Object.entries(plan.edits)) {
    const text = readText(disk.root, path)
    if (text === null) throw new Error(`Convert planned edits to ${path}, but the file is not there.`)
    if (!writeText(disk, path, applyEdits(text, list))) continue
    touched.push(path)
    edits += list.length
    perFile[path] = list.length
  }
  return { touched, edits, writes, perFile }
}

const json = (value: unknown): string => JSON.stringify(value, null, 2) + '\n'

/** Both messages files, by root-relative path, built from the ledger. */
export const messagesFiles = (ledger: LedgerEntry[]): Record<string, string> => ({
  [messagesPath('en')]: json(messagesFor(ledger, 'en')),
  [messagesPath('ar')]: json(messagesFor(ledger, 'ar')),
})

/** The files convert writes from its own templates and the ledger: the stylesheet and both messages files. */
export function ownFiles(project: Project, ledger: LedgerEntry[]): Record<string, string> {
  return { [stylesheetPath(project)]: dualkitCss(project), ...messagesFiles(ledger) }
}

/** Writes the stylesheet and messages, and imports the stylesheet in the entry file at its post-move path. */
export function addOwnFiles(disk: Disk, project: Project, ledger: LedgerEntry[], entry: string): Applied {
  const touched = Object.entries(ownFiles(project, ledger)).filter(([path, text]) => writeText(disk, path, text)).map(([path]) => path)
  const text = readText(disk.root, entry)
  if (text === null) throw new Error(`Convert could not read the entry file ${entry}.`)
  const outcome = parseSourceOutcome(entry, text, join(disk.root, entry))
  if ('error' in outcome) throw new Error(`The entry file ${entry} does not parse after wiring: ${outcome.error}`)
  const edit = importEdit(outcome.file, stylesheetPath(project))
  if (!edit || !writeText(disk, entry, applyEdits(outcome.file.text, [edit]))) return { touched, edits: 0 }
  return { touched: [...touched, entry], edits: 1 }
}

/** Writes the merged ledger. Returns whether it changed. */
export function saveLedger(disk: Disk, ledger: LedgerEntry[]): boolean {
  const before = readText(disk.root, LEDGER_FILE)
  writeLedger(disk.root, ledger)
  if (before === null) disk.created.push(LEDGER_FILE)
  return readText(disk.root, LEDGER_FILE) !== before
}

/** Adds each dependency the app does not already declare to package.json, keeping its indent. Returns whether it changed. */
export function addDependencies(disk: Disk, deps: Record<string, string>): boolean {
  const text = readText(disk.root, 'package.json')
  if (text === null) throw new Error('Convert could not read package.json.')
  const pkg = JSON.parse(text) as Record<string, Record<string, string> | undefined>
  const declared = { ...pkg.devDependencies, ...pkg.peerDependencies, ...pkg.dependencies }
  const missing = Object.entries(deps).filter(([name]) => !(name in declared))
  if (missing.length === 0) return false
  const dependencies = Object.fromEntries([...Object.entries(pkg.dependencies ?? {}), ...missing].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
  const indent = /^([ \t]+)"/m.exec(text)?.[1] ?? '  '
  return writeText(disk, 'package.json', JSON.stringify({ ...pkg, dependencies }, null, indent) + '\n')
}

/** The .gitignore lines that keep convert's state and summary tracked and the rest of its folder ignored. */
export const STATE_IGNORE = [`${STATE_DIR}/*`, `!${STATE_FILE}`, `!${SUMMARY_FILE}`]
const WHOLE_FOLDER = [STATE_DIR, `${STATE_DIR}/`, `/${STATE_DIR}`, `/${STATE_DIR}/`]

/**
 * Ignores the state folder in the app's .gitignore except the state and summary files. An older line that
 * ignores the whole folder is dropped, because git cannot re-include a file inside an ignored folder.
 * Returns whether it changed.
 */
export function ignoreStateDir(disk: Disk): boolean {
  const text = readText(disk.root, '.gitignore') ?? ''
  const lines = text.split(/\r?\n/)
  const kept = lines.filter((l) => !WHOLE_FOLDER.includes(l.trim()))
  const missing = STATE_IGNORE.filter((l) => !kept.some((k) => k.trim() === l))
  if (missing.length === 0 && kept.length === lines.length) return false
  const body = kept.join('\n').replace(/\n*$/, '')
  const out = body === '' ? missing : [body, ...missing]
  return writeText(disk, '.gitignore', `${out.join('\n')}\n`)
}
