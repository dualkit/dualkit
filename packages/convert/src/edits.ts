import type { Edit } from './types'

/** Thrown when two edits touch the same span. */
export class OverlapError extends Error {
  constructor(readonly first: Edit, readonly second: Edit) {
    super(`edits overlap: [${first.start}, ${first.end}) and [${second.start}, ${second.end})`)
    this.name = 'OverlapError'
  }
}

/** Throws when an edit's span is not inside the text. */
function checkBounds(text: string, edit: Edit): void {
  const span = `edit [${edit.start}, ${edit.end})`
  if (edit.end < edit.start) throw new RangeError(`${span} ends before it starts`)
  if (edit.start < 0 || edit.end > text.length) throw new RangeError(`${span} is outside the text, which is ${text.length} characters long`)
}

/**
 * Applies non-overlapping edits in any order. Edits that start at the same offset apply in their given
 * order, so an insert listed before a replacement at that offset lands before it. Throws on an edit
 * outside the text.
 */
export function applyEdits(text: string, edits: Edit[]): string {
  for (const edit of edits) checkBounds(text, edit)
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
