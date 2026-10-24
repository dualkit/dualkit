import { rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readText } from './apply'
import { cleanAtHead, restoreFromHead, unstage } from './git'
import { ConvertFailedError, reasonOf } from './rollback'

/** A path finish may write, as it was before: unchanged from HEAD, or its bytes (null when it did not exist). */
type Saved = { path: string; clean: boolean; text: string | null }

/** Records the paths finish may write, before it writes any of them. */
export async function snapshot(root: string, paths: readonly string[]): Promise<Saved[]> {
  const clean = new Set(await cleanAtHead(root, paths))
  return paths.map((path) => ({ path, clean: clean.has(path), text: clean.has(path) ? null : readText(root, path) }))
}

/**
 * Undoes finish's writes: paths that matched HEAD are checked out from HEAD, the rest get their earlier
 * bytes back or are deleted when they are new, so a person's uncommitted edits survive. `staged` (the
 * paths finish staged but never wrote, such as the ledger) are unstaged with their contents kept.
 */
async function undo(root: string, saved: readonly Saved[], staged: readonly string[]): Promise<void> {
  await restoreFromHead(root, saved.filter((s) => s.clean).map((s) => s.path))
  const dirty = saved.filter((s) => !s.clean)
  for (const { path, text } of dirty) {
    if (text === null) rmSync(join(root, path), { force: true })
    else writeFileSync(join(root, path), text)
  }
  await unstage(root, [...new Set([...dirty.map((s) => s.path), ...staged])])
}

/** Undoes finish's writes and throws one line naming the step. Always throws. */
export async function failFinish(root: string, saved: readonly Saved[], staged: readonly string[], step: string, error: unknown): Promise<never> {
  const failed = `finish failed at ${step}: ${reasonOf(error)}.`
  try {
    await undo(root, saved, staged)
  } catch (cause) {
    throw new ConvertFailedError(`${failed} Putting its files back also failed (${reasonOf(cause)}), so check git status. Nothing was committed.`, error)
  }
  throw new ConvertFailedError(`${failed} Nothing was committed.`, error)
}
