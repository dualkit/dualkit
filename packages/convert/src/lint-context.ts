import { POSTCSS_FLIPPERS, STYLIS_FLIPPERS, createFlipperLookup, quietReason, repoTop, type LintContext, type QuietReason, type SourceFile } from '@dualkit/lint'
import { resolve } from 'node:path'

const POSTCSS_LANGS = new Set(['css', 'scss', 'vue', 'svelte'])

/**
 * The part of lint's context that says which CSS a build step already mirrors and which files are not
 * bugs (generated, examples, email), built the way lint() builds it, so convert edits what lint flags.
 */
export function physicalContext(root: string): Pick<LintContext, 'blockFlipper' | 'physicalQuiet'> {
  const cwd = resolve(root)
  const top = repoTop(cwd) ?? cwd
  const postcssOf = createFlipperLookup(top, POSTCSS_FLIPPERS)
  const stylisOf = createFlipperLookup(top, STYLIS_FLIPPERS)
  const blockFlipper: NonNullable<LintContext['blockFlipper']> = (file, block) =>
    block.fromTemplate ? stylisOf(file.abs) : POSTCSS_LANGS.has(file.lang) ? postcssOf(file.abs) : null
  const reasons = new Map<string, QuietReason | null>()
  const physicalQuiet = (file: SourceFile): QuietReason | null => {
    const known = reasons.get(file.path)
    if (known !== undefined) return known
    const flipped = file.css.some((block) => blockFlipper(file, block) !== null)
    const reason = quietReason(file.path, file.text) ?? (flipped ? 'flipped' : null)
    reasons.set(file.path, reason)
    return reason
  }
  return { blockFlipper, physicalQuiet }
}
