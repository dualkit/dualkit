import type { Edit } from './types'

/** Thrown when two edits touch the same span. */
export class OverlapError extends Error {
  constructor(readonly first: Edit, readonly second: Edit) {
    super(`edits overlap: [${first.start}, ${first.end}) and [${second.start}, ${second.end})`)
    this.name = 'OverlapError'
  }
}

/** Applies non-overlapping edits in any order. Equal-start inserts keep their given order. */
export function applyEdits(text: string, edits: Edit[]): string {
  const ordered = edits
    .map((edit, index) => ({ edit, index }))
    .sort((a, b) => a.edit.start - b.edit.start || a.index - b.index)
    .map((entry) => entry.edit)
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1]!
    const next = ordered[i]!
    if (next.start < prev.end) throw new OverlapError(prev, next)
  }
  let out = ''
  let cursor = 0
  for (const edit of ordered) {
    out += text.slice(cursor, edit.start) + edit.text
    cursor = edit.end
  }
  return out + text.slice(cursor)
}
