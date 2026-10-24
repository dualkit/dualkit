import { isMinified, walk } from '@dualkit/lint'
import { join } from 'node:path'
import { addDependencies, addStylesheet, applyPlan, ignoreStateDir, messagesPath, readText, writeStrings, writeText } from './apply'
import { shootBaseline } from './baseline'
import { localeHelperPath } from './generate/locale'
import { wireNextIntl } from './generate/next-intl'
import { wireReactI18next } from './generate/react-i18next'
import { stylesheetPath } from './generate/stylesheet'
import { RefusedError, assertCleanRepo, branchExists, commit, createBranch, currentBranch, stage, stagedFiles, trackedFiles } from './git'
import { LEDGER_FILE, readLedger, type LedgerEntry } from './ledger'
import { physicalContext } from './lint-context'
import { runPasses, type PassContext } from './passes'
import { detectProject } from './project'
import { readState, saveState } from './state'
import type { ConvertIo, ConvertOptions, ConvertState, ConvertSummary, Flag, Mode, Plan, Project } from './types'

export type { ConvertIo, ConvertOptions, ConvertState, ConvertSummary, Shooter } from './types'

const BOM = '﻿'

const LOCKFILES: Record<Project['packageManager'], readonly string[]> = {
  npm: ['package-lock.json'], pnpm: ['pnpm-lock.yaml'], yarn: ['yarn.lock'], bun: ['bun.lock', 'bun.lockb'],
}

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
  const state = readState(options.root)
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

/** Runs the package manager install. A failed install becomes a flag rather than stopping the run. */
async function install(project: Project, io: ConvertIo): Promise<Flag[]> {
  const cmd = `${project.packageManager} install`
  io.log(`Running ${cmd}.`)
  const result = await io.run(cmd, project.root)
  if (result.code === 0) return []
  const message = `${cmd} exited with code ${result.code}, so the new packages may not be installed.`
  return [{ file: 'package.json', line: 1, kind: 'unsupported', message, suggestion: `Run ${cmd} yourself and fix what it reports.` }]
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
  const taken = new Set(readLedger(root).map((e) => e.key))

  const done = transformAll(project, generated, taken)
  const plan = await planFor(project, mode, done.texts)
  const moved = new Map(plan.moves)
  const at = (path: string): string => moved.get(path) ?? path

  if (!rerun) {
    await baseline(project, options, io)
    await createBranch(root, branch)
    io.log(`Created the branch ${branch}.`)
  }
  const touched: string[] = []
  for (const [path, text] of done.texts) if (writeText(root, path, text)) touched.push(at(path))
  const wired = await applyPlan(root, plan)
  const styled = addStylesheet(root, project, at(project.entry))
  const entries = done.entries.map((e) => ({ ...e, file: at(e.file) }))
  const strings = writeStrings(root, entries)
  touched.push(...wired.touched, ...styled.touched, ...strings.touched)
  if (addDependencies(root, plan.deps)) touched.push('package.json')
  const installFlags = options.install ? await install(project, io) : []
  if (options.install) touched.push(...LOCKFILES[project.packageManager].filter((f) => readText(root, f) !== null))
  if (ignoreStateDir(root)) touched.push('.gitignore')

  const written = [...Object.keys(plan.writes), stylesheetPath(project), LEDGER_FILE, messagesPath('en'), messagesPath('ar')]
  saveState(root, { mode, base: rerun ? state?.base ?? base : base, branch, framework: project.framework, phase: 'converted', generated: [...new Set([...generated, ...written])].sort() })

  await stage(root, [...new Set(touched)])
  const changed = await stagedFiles(root)
  if (changed.length) {
    await commit(root, `dualkit: convert to ${mode}`)
    io.log(`Committed ${changed.length} changed files on ${branch}.`)
  } else {
    io.log('Nothing changed, so there is nothing to commit.')
  }
  const flags = finalFlags([...done.flags, ...plan.flags, ...installFlags], moved)
  io.log(`${problems(flags).length} things are left to finish. ${done.skipped.length} files were skipped.`)
  return { branch, filesChanged: changed.length, edits: done.edits + wired.edits + styled.edits, flags, strings: strings.ledger.length - taken.size, skipped: done.skipped }
}
