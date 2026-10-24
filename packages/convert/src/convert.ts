import { isMinified, walk } from '@dualkit/lint'
import { join } from 'node:path'
import { ownFiles, readText, type Disk } from './apply'
import { shootBaseline } from './baseline'
import { guardWrites, localeHelperPath } from './generate/locale'
import { wireNextIntl } from './generate/next-intl'
import { wireReactI18next } from './generate/react-i18next'
import { RefusedError, assertCleanRepo, branchExists, createBranch, currentBranch, trackedFiles } from './git'
import { LEDGER_FILE, mergeLedger, readLedger, type LedgerEntry } from './ledger'
import { physicalContext } from './lint-context'
import { runPasses, type PassContext } from './passes'
import { detectProject } from './project'
import { rollBack } from './rollback'
import { readState, saveState } from './state'
import { writeAll } from './write-all'
import type { ConvertIo, ConvertOptions, ConvertState, ConvertSummary, Flag, Mode, Plan, Project } from './types'

export type { ConvertIo, ConvertOptions, ConvertState, ConvertSummary, Shooter } from './types'

const BOM = '﻿'

/** The branch a mode converts on. */
export const branchFor = (mode: Mode): string => `dualkit/${mode}`

/** The flags a person or agent still has to act on. Info flags are kept in the summary but are never problems. */
export const problems = (flags: readonly Flag[]): Flag[] => flags.filter((f) => f.kind !== 'info')

type Transformed = { texts: Map<string, string>; edits: number; flags: Flag[]; entries: LedgerEntry[]; skipped: ConvertSummary['skipped'] }

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
  const out: Transformed = { texts: new Map(), edits: 0, flags: [], entries: [], skipped: [...walked.skipped] }
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
    out.texts.set(path, raw.startsWith(BOM) ? BOM + result.text : result.text)
  }
  return out
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
  const rerun = base === branch && state?.phase === 'converted' && state.mode === options.mode
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

/**
 * Phase 1: converts the app at `options.root` on the branch `dualkit/<mode>` and commits it with the
 * person's own git identity. Transforms run in memory first, so a refusal changes nothing. A re-run on
 * a branch convert already converted runs again in place and commits only when something changed.
 */
export async function convert(options: ConvertOptions, io: ConvertIo): Promise<ConvertSummary> {
  const { root, mode } = options
  const { state, rerun, base } = await start(options)
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
  io.log(written.changed.length ? `Committed ${written.changed.length} changed files on ${branch}.` : 'Nothing changed, so there is nothing to commit.')

  const ours = [...Object.keys(plan.writes), ...Object.keys(ownFiles(project, ledger)), LEDGER_FILE]
  saveState(root, { mode, base: state?.base ?? base, branch, framework: project.framework, phase: 'converted', generated: [...new Set([...generated, ...ours])].sort() })
  const flags = finalFlags([...done.flags, ...plan.flags, ...written.flags], moved)
  io.log(`${problems(flags).length} things are left to finish. ${done.skipped.length} files were skipped.`)
  return { branch, filesChanged: written.changed.length, edits: done.edits + written.edits, flags, strings: ledger.length - existing.length, skipped: done.skipped }
}
