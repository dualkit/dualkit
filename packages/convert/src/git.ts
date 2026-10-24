import { execFile } from 'node:child_process'
import { STATE_DIR } from './state'

/** Thrown when convert will not start. The message is one line saying why. */
export class RefusedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RefusedError'
  }
}

type Result = { code: number; out: string; stdout: string }

export const NO_GIT = 'git is not installed or not on PATH'

/** Runs git in cwd with literal pathspecs, so a path such as app/[locale]/page.tsx is never read as a pattern. */
function git(cwd: string, args: string[]): Promise<Result> {
  return new Promise((resolve, reject) => {
    execFile('git', ['--literal-pathspecs', ...args], { cwd, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && error.code === 'ENOENT') return reject(new Error(NO_GIT))
      const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0
      resolve({ code, out: `${stdout}${stderr}`.trim(), stdout })
    })
  })
}

/** Runs git and throws with its output when it fails. */
async function must(cwd: string, args: string[]): Promise<string> {
  const result = await git(cwd, args)
  if (result.code !== 0) throw new Error(`git ${args[0]} failed${result.out ? `: ${result.out}` : ''}`)
  return result.out
}

/** Paths in `git status` that are convert's own state folder, which is never part of the person's work. */
const isStatePath = (entry: string, prefix: string): boolean => entry.slice(3).startsWith(`${prefix}${STATE_DIR}/`)

/** Refuses unless root is inside a git work tree with nothing uncommitted, convert's own .dualkit folder aside. */
export async function assertCleanRepo(root: string): Promise<void> {
  const inside = await git(root, ['rev-parse', '--is-inside-work-tree'])
  if (inside.code !== 0 || inside.out !== 'true') throw new RefusedError(`${root} is not inside a git repo. Convert works on a new branch, so run git init and commit first.`)
  const prefix = await must(root, ['rev-parse', '--show-prefix'])
  const status = await git(root, ['status', '--porcelain', '-z'])
  if (status.code !== 0) throw new Error(`git status failed: ${status.out}`)
  const entries = status.stdout.split('\0').filter(Boolean)
  if (entries.some((entry) => !isStatePath(entry, prefix))) throw new RefusedError('This repo has uncommitted changes. Commit or stash them, then run convert again.')
}

/** The current branch name, or the short commit when HEAD is detached. */
export async function currentBranch(root: string): Promise<string> {
  const name = await git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'])
  return name.code === 0 ? name.out : must(root, ['rev-parse', '--short', 'HEAD'])
}

export async function branchExists(root: string, branch: string): Promise<boolean> {
  return (await git(root, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`])).code === 0
}

/** Creates branch from HEAD and switches to it. */
export async function createBranch(root: string, branch: string): Promise<void> {
  await must(root, ['checkout', '-q', '-b', branch])
}

/** Moves a tracked file with git mv. The destination folder must exist. Paths are relative to root. */
export async function moveFile(root: string, from: string, to: string): Promise<void> {
  await must(root, ['mv', '--', from, to])
}

/** Resets the index and tracked files to HEAD. Untracked and ignored files are left alone. */
export async function resetHard(root: string): Promise<void> {
  await must(root, ['reset', '-q', '--hard'])
}

export async function checkout(root: string, ref: string): Promise<void> {
  await must(root, ['checkout', '-q', ref])
}

export async function deleteBranch(root: string, branch: string): Promise<void> {
  await must(root, ['branch', '-q', '-D', branch])
}

/** Stages the named paths, relative to root. A path that no longer exists is staged as removed. */
export async function stage(root: string, paths: readonly string[]): Promise<void> {
  if (paths.length) await must(root, ['add', '-A', '--', ...paths])
}

/** The staged paths, counting a rename once. */
export async function stagedFiles(root: string): Promise<string[]> {
  const out = await must(root, ['diff', '--cached', '--name-only', '-z', '-M'])
  return out.split('\0').filter(Boolean)
}

/** Commits what is staged with the person's own git identity. */
export async function commit(root: string, message: string): Promise<void> {
  await must(root, ['commit', '-q', '-m', message])
}

/** Every tracked file under root, relative to root. */
export async function trackedFiles(root: string): Promise<string[]> {
  const out = await must(root, ['ls-files', '-z'])
  return out.split('\0').filter(Boolean).sort()
}

/** Of the given paths relative to root, those in HEAD with no change in the index or the work tree. */
export async function cleanAtHead(root: string, paths: readonly string[]): Promise<string[]> {
  if (!paths.length) return []
  const inHead = new Set((await must(root, ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', ...paths])).split('\0').filter(Boolean))
  const changed = new Set((await must(root, ['diff', 'HEAD', '--relative', '--name-only', '-z', '--', ...paths])).split('\0').filter(Boolean))
  return paths.filter((p) => inHead.has(p) && !changed.has(p))
}

/** Puts the named paths back as they are in HEAD, in the index and the work tree. */
export async function restoreFromHead(root: string, paths: readonly string[]): Promise<void> {
  if (paths.length) await must(root, ['checkout', 'HEAD', '--', ...paths])
}

/** Unstages the named paths, leaving the work tree alone. */
export async function unstage(root: string, paths: readonly string[]): Promise<void> {
  if (paths.length) await must(root, ['reset', '-q', '--', ...paths])
}
