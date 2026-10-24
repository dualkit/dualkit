import { execFile } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** Thrown when convert will not start. The message is one line saying why. */
export class RefusedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RefusedError'
  }
}

type Result = { code: number; out: string }

/** Runs git in cwd with literal pathspecs, so a path such as app/[locale]/page.tsx is never read as a pattern. */
function git(cwd: string, args: string[]): Promise<Result> {
  return new Promise((resolve) => {
    execFile('git', ['--literal-pathspecs', ...args], { cwd, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0
      resolve({ code, out: `${stdout}${stderr}`.trim() })
    })
  })
}

/** Runs git and throws with its output when it fails. */
async function must(cwd: string, args: string[]): Promise<string> {
  const result = await git(cwd, args)
  if (result.code !== 0) throw new Error(`git ${args[0]} failed: ${result.out}`)
  return result.out
}

/** Refuses unless root is inside a git work tree with nothing uncommitted. */
export async function assertCleanRepo(root: string): Promise<void> {
  const inside = await git(root, ['rev-parse', '--is-inside-work-tree'])
  if (inside.code !== 0 || inside.out !== 'true') throw new RefusedError(`${root} is not inside a git repo. Convert works on a new branch, so run git init and commit first.`)
  const status = await must(root, ['status', '--porcelain'])
  if (status !== '') throw new RefusedError('This repo has uncommitted changes. Commit or stash them, then run convert again.')
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

/** Moves a tracked file with git mv, creating the destination folder first. Paths are relative to root. */
export async function moveFile(root: string, from: string, to: string): Promise<void> {
  mkdirSync(dirname(join(root, to)), { recursive: true })
  await must(root, ['mv', '--', from, to])
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
