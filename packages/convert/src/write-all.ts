import { addDependencies, addOwnFiles, applyPlan, ignoreStateDir, readText, saveLedger, writeText, type Disk } from './apply'
import { writeConfigAnswers, CONFIG_FILE } from './config-answers'
import { commit, stage, stagedFiles } from './git'
import { LEDGER_FILE, type LedgerEntry } from './ledger'
import { STATE_FILE, stateText } from './state'
import { SUMMARY_FILE, summaryText } from './summary'
import type { ConvertIo, ConvertOptions, ConvertState, ConvertSummary, Flag, Plan, Project } from './types'

const LOCKFILES: Record<Project['packageManager'], readonly string[]> = {
  npm: ['package-lock.json'], pnpm: ['pnpm-lock.yaml'], yarn: ['yarn.lock'], bun: ['bun.lock', 'bun.lockb'],
}

/** What the disk phase applied: the staged files, wiring edits and any install flag. */
/** What the disk phase applied: changed paths, edits and new files it actually wrote, wiring edits per file, and install flags. */
export type Written = { changed: string[]; edits: number; writes: number; wired: Record<string, number>; flags: Flag[] }

/** Everything the disk phase needs. `step.name` is kept current so a failure can say where it happened. */
export type WriteInput = {
  disk: Disk
  project: Project
  options: ConvertOptions
  io: ConvertIo
  texts: ReadonlyMap<string, string>
  plan: Plan
  ledger: LedgerEntry[]
  step: { name: string }
  /** The state and summary to commit, given what the disk phase applied. Called only when something changed. */
  record: (applied: Written) => { state: ConvertState; summary: ConvertSummary }
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

/** Runs install, records any lockfile it created for rollback, and throws when the run was interrupted meanwhile. */
async function installed(disk: Disk, project: Project, io: ConvertIo): Promise<Flag[]> {
  const lockfiles = LOCKFILES[project.packageManager]
  const before = new Set(lockfiles.filter((f) => readText(disk.root, f) !== null))
  const flags = await install(project, io)
  disk.created.push(...lockfiles.filter((f) => !before.has(f) && readText(disk.root, f) !== null))
  if (io.signal?.aborted) throw new Error('the run was interrupted')
  return flags
}

/**
 * The disk phase, in order: converted files, wiring (moves, writes, edits), stylesheet and messages,
 * ledger, package.json, install, .gitignore, then, when anything changed, the state and summary and one commit of the named paths.
 */
export async function writeAll(input: WriteInput): Promise<Written> {
  const { disk, project, options, io, plan, step } = input
  const moved = new Map(plan.moves)
  const touched: string[] = []
  for (const [path, text] of input.texts) if (writeText(disk, path, text)) touched.push(moved.get(path) ?? path)
  step.name = 'wiring locales'
  const wired = await applyPlan(disk, plan)
  step.name = 'adding the stylesheet and messages'
  const own = addOwnFiles(disk, project, input.ledger, moved.get(project.entry) ?? project.entry)
  step.name = 'writing the strings ledger'
  if (saveLedger(disk, input.ledger)) touched.push(LEDGER_FILE)
  touched.push(...wired.touched, ...own.touched)
  step.name = 'saving your answers'
  const configFile = options.configFile ?? CONFIG_FILE
  if (options.configAnswers && writeConfigAnswers(disk, options.configAnswers, configFile)) touched.push(configFile)
  step.name = 'updating package.json'
  const added = addDependencies(disk, plan.deps)
  if (added) touched.push('package.json')
  step.name = 'installing packages'
  const flags = options.install && added ? await installed(disk, project, io) : []
  if (options.install && added) touched.push(...LOCKFILES[project.packageManager].filter((f) => readText(disk.root, f) !== null))
  step.name = 'updating .gitignore'
  if (ignoreStateDir(disk)) touched.push('.gitignore')
  step.name = 'committing'
  await stage(disk.root, [...new Set(touched)])
  const changed = await stagedFiles(disk.root)
  const edits = wired.edits + own.edits
  if (changed.length) {
    step.name = 'saving the state'
    const { state, summary } = input.record({ changed, edits, writes: wired.writes, wired: wired.perFile, flags })
    writeText(disk, STATE_FILE, stateText(state))
    writeText(disk, SUMMARY_FILE, summaryText(summary))
    await stage(disk.root, [STATE_FILE, SUMMARY_FILE])
    step.name = 'committing'
    await commit(disk.root, `dualkit: convert to ${options.mode}`)
  }
  return { changed, edits, writes: wired.writes, wired: wired.perFile, flags }
}
