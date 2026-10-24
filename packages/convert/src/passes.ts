import { parseSourceOutcome, type LintContext, type SourceFile } from '@dualkit/lint'
import { applyEdits, OverlapError } from './edits'
import type { LedgerEntry } from './ledger'
import { cssEdits } from './transforms/css'
import { formatEdits } from './transforms/formats'
import { markupEdits } from './transforms/markup'
import { extractStrings, type Lib } from './transforms/strings'
import { tailwindEdits } from './transforms/tailwind'
import type { EditKind, FileResult, Flag } from './types'

/** What every pass needs to know about the app. `taken` holds the ledger keys already in use; it is read, never changed. */
export type PassContext = {
  tailwind: string | null
  lib: Lib
  helper: string
  css: Pick<LintContext, 'blockFlipper' | 'physicalQuiet'>
  taken: Set<string>
}

/** One file after every pass, or the reason it was left as it was. */
export type FileOutcome =
  | { kind: 'done'; text: string; edits: number; byKind: Record<PassKind, number>; flags: Flag[]; entries: LedgerEntry[] }
  | { kind: 'skipped'; reason: string }

/** The names of the passes. */
export type PassKind = Exclude<EditKind, 'wiring'>

type Pass = { name: PassKind; run: (file: SourceFile, ctx: PassContext) => FileResult & { entries?: LedgerEntry[] } }

/** The passes in the order they run. Each sees the file as the one before left it. */
const PASSES: readonly Pass[] = [
  { name: 'tailwind', run: (file, ctx) => tailwindEdits(file, ctx.tailwind) },
  { name: 'css', run: (file, ctx) => cssEdits(file, ctx.css) },
  { name: 'markup', run: (file) => markupEdits(file) },
  { name: 'strings', run: (file, ctx) => extractStrings(file, ctx.lib, ctx.taken) },
  { name: 'formats', run: (file, ctx) => formatEdits(file, ctx.lib, ctx.helper) },
]

const parse = (path: string, text: string, abs: string): SourceFile | string => {
  const outcome = parseSourceOutcome(path, text, abs)
  return 'file' in outcome ? outcome.file : outcome.error
}

/**
 * Runs every pass over one file in memory, applying each pass's edits and parsing again before the next.
 * A file that does not parse, or that a pass would break, is skipped whole and never half-edited.
 */
export function runPasses(path: string, text: string, abs: string, ctx: PassContext): FileOutcome {
  const first = parse(path, text, abs)
  if (typeof first === 'string') return { kind: 'skipped', reason: `parse error: ${first}` }
  let file = first
  let edits = 0
  const byKind: Record<PassKind, number> = { tailwind: 0, css: 0, markup: 0, strings: 0, formats: 0 }
  const flags: Flag[] = []
  const entries: LedgerEntry[] = []
  const taken = new Set(ctx.taken)
  for (const pass of PASSES) {
    const result = pass.run(file, { ...ctx, taken })
    flags.push(...result.flags)
    for (const entry of result.entries ?? []) {
      entries.push(entry)
      taken.add(entry.key)
    }
    if (result.edits.length === 0) continue
    let next: string
    try {
      next = applyEdits(file.text, result.edits)
    } catch (error) {
      if (!(error instanceof OverlapError)) throw error
      return { kind: 'skipped', reason: `the ${pass.name} pass made overlapping edits, so convert left the file as it was` }
    }
    const reparsed = parse(path, next, abs)
    if (typeof reparsed === 'string') return { kind: 'skipped', reason: `the ${pass.name} pass made code that does not parse, so convert left the file as it was` }
    file = reparsed
    edits += result.edits.length
    byKind[pass.name] += result.edits.length
  }
  return { kind: 'done', text: file.text, edits, byKind, flags, entries }
}
