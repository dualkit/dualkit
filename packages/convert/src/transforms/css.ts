import { liveDeclarations, physicalDeclarations, type LintContext, type LiveDeclaration, type PhysicalDeclaration, type SourceFile } from '@dualkit/lint'
import type { Edit, FileResult, Flag } from '../types'
import { noLogicalForm, splitShorthand } from './css-values'
import { jsxStyleResult } from './css-jsx'
import { lineOf } from './lines'

/** Where a declaration's text sits in the file, or null when the parsed positions do not match the source. */
function spans(file: SourceFile, d: LiveDeclaration): { start: number; name: number; value: number; end: number } | null {
  const end = d.block.offset + (d.decl.source?.end?.offset ?? -1) + 1
  const name = d.offset + d.decl.prop.length
  const value = name + (d.decl.raws.between?.length ?? 0)
  if (end <= value || file.text.slice(d.offset, name).toLowerCase() !== d.prop) return null
  return { start: d.offset, name, value, end }
}

function renameEdits(file: SourceFile, d: PhysicalDeclaration): Edit[] {
  const at = spans(file, d)
  if (!at) return []
  if (d.property) return [{ start: at.start, end: at.name, text: d.property }]
  if (!d.word || file.text.slice(at.value, at.value + d.decl.value.length) !== d.decl.value) return []
  return [{ start: at.value, end: at.value + d.decl.value.length, text: d.word }]
}

function shorthandEdits(file: SourceFile, d: LiveDeclaration): Edit[] {
  const split = splitShorthand(d.prop, d.decl.value, d.value)
  const at = spans(file, d)
  if (!split || !at || d.decl.raws.value) return []
  const important = d.decl.important ? (d.decl.raws.important ?? ' !important') : ''
  const text = `${split.property}-block: ${split.block}${important}; ${split.property}-inline: ${split.inline}${important}`
  const raw = file.text.slice(at.start, at.end)
  return [{ start: at.start, end: at.start + raw.replace(/\s*;?\s*$/, '').length, text }]
}

function noFormFlag(file: SourceFile, d: LiveDeclaration): Flag[] {
  const suggestion = noLogicalForm(d)
  if (!suggestion) return []
  const message = `\`${d.prop}: ${d.shown}\` has no logical form in CSS and stays physical in Arabic.`
  return [{ file: file.path, line: lineOf(file.text, d.offset), kind: 'no-logical-form', message, suggestion }]
}

/**
 * Converts physical CSS to logical CSS in stylesheets, inline style blocks, template CSS and JSX style
 * objects, and flags declarations that have no logical form. What lint treats as not a bug is left alone.
 * `ctx` is lint's context; pass blockFlipper and physicalQuiet to skip CSS a build step already mirrors.
 */
export function cssEdits(file: SourceFile, ctx: Partial<LintContext> = {}): FileResult {
  const live = liveDeclarations(file, ctx)
  const edits = [
    ...physicalDeclarations(file, ctx).flatMap((d) => renameEdits(file, d)),
    ...live.flatMap((d) => shorthandEdits(file, d)),
  ]
  const flags = live.flatMap((d) => noFormFlag(file, d))
  const quiet = ctx.physicalQuiet?.(file)
  const jsx = quiet && quiet !== 'flipped' ? { edits: [], flags: [] } : jsxStyleResult(file)
  return { edits: [...edits, ...jsx.edits], flags: [...flags, ...jsx.flags].sort((a, b) => a.line - b.line) }
}
