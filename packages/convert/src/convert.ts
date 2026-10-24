import { isMinified, walk } from '@dualkit/lint'
import { join } from 'node:path'
import { ownFiles, readText, type Disk } from './apply'
import { checkConfigAnswers } from './config-answers'
import { shootBaseline } from './baseline'
import { guardWrites, localeHelperPath } from './generate/locale'
import { wireNextIntl } from './generate/next-intl'
import { wireReactI18next } from './generate/react-i18next'
import { RefusedError, assertCleanRepo, branchExists, createBranch, currentBranch, trackedFiles } from './git'
import { LEDGER_FILE, mergeLedger, readLedger, type LedgerEntry } from './ledger'
import { physicalContext } from './lint-context'
import { runPasses, type PassContext, type PassKind } from './passes'
import { detectProject } from './project'
import { rollBack } from './rollback'
import { readState, saveState } from './state'
import { mergeSummary, readSummary, saveSummary } from './summary'
import { writeAll } from './write-all'
import type { ConvertIo, ConvertOptions, ConvertState, ConvertSummary, Flag, Mode, Plan, Project } from './types'

export type { ConvertIo, ConvertOptions, ConvertState, ConvertSummary, Shooter } from './types'

const BOM = '﻿'

/** The branch a mode converts on. */
export const branchFor = (mode: Mode): string => `dualkit/${mode}`

/** The flags a person or agent still has to act on. Info flags are kept in the summary but are never problems. */
export const problems = (flags: readonly Flag[]): Flag[] => flags.filter((f) => f.kind !== 'info')

type Transformed = { texts: Map<string, string>; edits: number; byKind: Record<PassKind, number>; perFile: Map<string, number>; flags: Flag[]; entries: LedgerEntry[]; skipped: ConvertSummary['skipped'] }

/** Runs every pass over every walked file in memory, on pre-move paths. Files convert generated are left out. */
function transformAll(project: Project, generated: ReadonlySet<string>, taken: ReadonlySet<string>): Transformed {
  const { root } = project
  const walked = walk(['.'], root)
  const used = new Set(taken)
  const ctx: Omit<PassContext, 'taken'> = {
    tailwind: project.tailwind,
    lib: project.framework === 'next-app' ? 'next-intl' : 'react-i18next',
    helper: localeHelperPath(project),
    css: physicalContext(root),
  }
  const out: Transformed = { texts: new Map(), edits: 0, byKind: { tailwind: 0, css: 0, markup: 0, strings: 0, formats: 0 }, perFile: new Map(), flags: [], entries: [], skipped: [...walked.skipped] }
  for (const path of walked.files) {
    if (generated.has(path)) continue
    const raw = readText(root, path)
    if (raw === null) { out.skipped.push({ file: path, reason: 'unreadable' }); continue }
    if (isMinified(raw)) { out.skipped.push({ file: path, reason: 'minified' }); continue }
    const result = runPasses(path, raw, join(root, path), { ...ctx, taken: used })
    if (result.kind === 'skipped') { out.skipped.push({ file: path, reason: result.reason }); continue }
    out.flags.push(...result.flags)
    out.entries.push(...result.entries)
    for (const entry of result.entries) used.add(entry.key)
    if (result.edits === 0) continue
    out.edits += result.edits
    for (const kind of Object.keys(out.byKind) as PassKind[]) out.byKind[kind] += result.byKind[kind]
    out.perFile.set(path, result.edits)
    out.texts.set(path, raw.startsWith(BOM) ? BOM + result.text : result.text)
  }
  return out
}

/** Applied edits per file at post-move paths, sorted by file. */
function changedFiles(perFile: ReadonlyMap<string, number>, moved: ReadonlyMap<string, string>, wiring: Plan['edits']): ConvertSummary['changed'] {
  const total = new Map<string, number>()
  const add = (file: string, n: number): void => { if (n > 0) total.set(file, (total.get(file) ?? 0) + n) }
  for (const [path, n] of perFile) add(moved.get(path) ?? path, n)
  for (const [path, list] of Object.entries(wiring)) add(path, list.length)
  return [...total].map(([file, edits]) => ({ file, edits })).sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))
}

/** The wiring plan, read from the post-transform contents of each pre-move path. */
async function planFor(project: Project, mode: Mode, texts: ReadonlyMap<string, string>): Promise<Plan> {
  const files = (rel: string): string | null => texts.get(rel) ?? readText(project.root, rel)
  if (project.framework === 'vite-react') return wireReactI18next(project, mode, files)
  return wireNextIntl(project, mode, files, await trackedFiles(project.root))
}

/** Keeps the first of each flag with the same file, line, kind and message, with files at their post-move paths. */
function finalFlags(flags: readonly Flag[], moved: ReadonlyMap<string, string>): Flag[] {
  const seen = new Set<string>()
  return flags.map((f) => ({ ...f, file: moved.get(f.file) ?? f.file })).filter((f) => {
    const key = `${f.file}\0${f.line}\0${f.kind}\0${f.message}`
    return !seen.has(key) && Boolean(seen.add(key))
  })
}

/** Refuses unless the tree is clean and the branch is free, or this is a re-run on a branch convert already converted. */
async function start(options: ConvertOptions): Promise<{ state: ConvertState | null; rerun: boolean; base: string }> {
  await assertCleanRepo(options.root)
  const branch = branchFor(options.mode)
  const base = await currentBranch(options.root)
  const state = base === branch ? readState(options.root) : null
  // A finished conversion can run again too, for example after new pages are added on the branch.
  const rerun = base === branch && (state?.phase === 'converted' || state?.phase === 'finished') && state.mode === options.mode
  if (!rerun && (await branchExists(options.root, branch))) {
    throw new RefusedError(`The branch ${branch} already exists. Delete it, or switch to it if convert made it, then run convert again.`)
  }
  return { state, rerun, base }
}

/** Takes the English baseline when asked and a start command and shooter are there. */
async function baseline(project: Project, options: ConvertOptions, io: ConvertIo): Promise<void> {
  if (!options.baseline) return
  const { start: cmd } = io.config
  if (!cmd || !io.shoot) {
    io.log('No start command is set, so no English baseline was taken.')
    return
  }
  const { unreachable } = await shootBaseline(project, { ...io.config, start: cmd }, io.shoot, io.log)
  for (const page of unreachable) io.log(`No baseline for ${page.route}: ${page.reason}.`)
}

/** The line that says how many changed files phase 1 committed. */
export const committedLine = (files: number, branch: string): string =>
  `Committed ${files} changed ${files === 1 ? 'file' : 'files'} on ${branch}.`

/** The line that says how many places are left and how many files were skipped. */
export const leftLine = (open: number, skipped: number): string =>
  `${open} ${open === 1 ? 'thing is' : 'things are'} left to finish. ${skipped} ${skipped === 1 ? 'file was' : 'files were'} skipped.`

/**
 * Phase 1: converts the app at `options.root` on the branch `dualkit/<mode>` and commits it with the
 * person's own git identity. Transforms run in memory first, so a refusal changes nothing. A re-run on
 * a branch convert already converted runs again in place and commits only when something changed.
 */
export async function convert(options: ConvertOptions, ioIn: ConvertIo): Promise<ConvertSummary> {
  const { root, mode } = options
  const { state, rerun, base } = await start(options)
  if (options.configAnswers) checkConfigAnswers(root, options.configFile)
  // Answers taken before the branch existed are part of the config this run uses, the baseline included.
  const io: ConvertIo = options.configAnswers ? { ...ioIn, config: { ...ioIn.config, ...options.configAnswers } } : ioIn
  const project = detectProject(root)
  const branch = branchFor(mode)
  const generated = new Set(state?.generated ?? [])
  const existing = readLedger(root)

  const done = transformAll(project, generated, new Set(existing.map((e) => e.key)))
  const plan = await planFor(project, mode, done.texts)
  const moved = new Map(plan.moves)
  const ledger = mergeLedger(existing, done.entries.map((e) => ({ ...e, file: moved.get(e.file) ?? e.file })))
  guardWrites(ownFiles(project, ledger), (rel) => readText(root, rel), generated)

  if (!rerun) {
    await baseline(project, options, io)
    await createBranch(root, branch)
    io.log(`Created the branch ${branch}.`)
  }
  const disk: Disk = { root, created: [] }
  const step = { name: 'writing the converted files' }
  const written = await writeAll({ disk, project, options, io, texts: done.texts, plan, ledger, step })
    .catch((error: unknown) => rollBack({ root, base: rerun ? branch : base, branch, madeBranch: !rerun, created: disk.created }, step.name, error))
  io.log(written.changed.length ? committedLine(written.changed.length, branch) : 'Nothing changed, so there is nothing to commit.')

  const ours = [...Object.keys(plan.writes), ...Object.keys(ownFiles(project, ledger)), LEDGER_FILE]
  saveState(root, { mode, base: state?.base ?? base, branch, framework: project.framework, phase: 'converted', generated: [...new Set([...generated, ...ours])].sort() })
  const flags = finalFlags([...done.flags, ...plan.flags, ...written.flags], moved)
  io.log(leftLine(problems(flags).length, done.skipped.length))
  const byKind = { ...done.byKind, wiring: written.edits + Object.keys(plan.writes).length }
  const changed = changedFiles(done.perFile, moved, plan.edits)
  const summary: ConvertSummary = { branch, filesChanged: written.changed.length, edits: done.edits + written.edits, byKind, changed, flags, strings: ledger.length - existing.length, skipped: done.skipped }
  const earlier = readSummary(root)
  if (!earlier || written.changed.length > 0) saveSummary(root, mergeSummary(earlier, summary))
  return summary
}
