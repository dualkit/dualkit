import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { checkout, deleteBranch, resetHard } from './git'

/** Where a failed run puts the repo back: `base` is checked out, and `branch` is deleted when convert made it this run. */
export type RollbackTarget = { root: string; base: string; branch: string; madeBranch: boolean; created: readonly string[] }

/** Thrown when a run fails after the branch was created. The message names the step and where the repo now is. */
export class ConvertFailedError extends Error {
  constructor(message: string, readonly cause: unknown) {
    super(message)
    this.name = 'ConvertFailedError'
  }
}

const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : String(error)).replace(/\.$/, '')

/** The commands that put the repo back by hand. */
function manualSteps(target: RollbackTarget): string {
  const commands = ['git reset --hard', ...(target.madeBranch ? [`git checkout ${target.base}`, `git branch -D ${target.branch}`] : [])]
  const files = target.created.length ? `, then delete these new files: ${target.created.join(', ')}` : ''
  return `${commands.join(', then ')}${files}`
}

/**
 * Undoes a failed run: resets tracked files to HEAD (the tree was clean before), deletes only the files
 * convert created, then returns to the base branch and deletes the new one. Never runs git clean, so
 * ignored files such as .env are safe. Always throws.
 */
export async function rollBack(target: RollbackTarget, step: string, error: unknown): Promise<never> {
  const failed = `convert failed at ${step}: ${reasonOf(error)}.`
  try {
    await resetHard(target.root)
    for (const path of [...target.created].reverse()) rmSync(join(target.root, path), { recursive: true, force: true })
    if (target.madeBranch) {
      await checkout(target.root, target.base)
      await deleteBranch(target.root, target.branch)
    }
  } catch (undo) {
    throw new ConvertFailedError(`${failed} Putting the repo back also failed (${reasonOf(undo)}), so run these yourself: ${manualSteps(target)}.`, error)
  }
  const where = target.madeBranch ? target.base : target.branch
  throw new ConvertFailedError(`${failed} Your repo is back on ${where} as it was.`, error)
}
