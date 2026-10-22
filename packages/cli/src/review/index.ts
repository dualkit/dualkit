import type { Finding } from '@dualkit/rules'
import type { AuditResult } from '../audit'
import { detectFeatures } from './features'
import type { VisionModel } from './model'
import { candidates, findingsFrom, lineOf } from './position'
import { buildAsk } from './prompt'
import { cropPng, reflect, type Vision } from './reflect'
import { pickRules } from './rules'
import { tiles } from './tiles'

export type { Vision } from './reflect'
export type ReviewOptions = { source: string | null; vision: Vision; model: VisionModel; log: (line: string) => void }
export type ReviewResult = { findings: Finding[]; spentUsd: number; skipped: string | null; unchecked: number }

const MAX_TILES = 4
const CANDIDATE_LIMIT = 150
/** Source lines kept either side of a finding's line when the model double-checks it. */
const EXCERPT_RADIUS = 3
/** The width field of a PNG header, read without decoding the image. */
const pngWidth = (base64: string): number => Buffer.from(base64.slice(0, 48), 'base64').readUInt32BE(16)

const excerpt = (source: string | null, line: number | null | undefined): string | null => {
  if (source === null || line === null || line === undefined) return null
  return source.split('\n').slice(Math.max(0, line - 1 - EXCERPT_RADIUS), line + EXCERPT_RADIUS).join('\n')
}

/** Asks a vision model for problems the rules cannot see, then has it double-check each one on a close crop. */
export async function review(result: AuditResult, { source, vision, model, log }: ReviewOptions): Promise<ReviewResult> {
  const screen = result.screen
  if (!screen || !result.screenshot) return { findings: [], spentUsd: 0, skipped: 'No screenshot to review', unchecked: 0 }
  let spentUsd = 0
  const counted: Vision = async (m, ask) => {
    const answer = await vision(m, ask)
    if (answer.ok) spentUsd += answer.costUsd
    return answer
  }
  const cands = candidates(screen, CANDIDATE_LIMIT)
  if (cands.length === 0) return { findings: [], spentUsd, skipped: null, unchecked: 0 }
  let slices: string[]
  let scale: number
  try {
    scale = pngWidth(result.screenshot) / result.width
    slices = tiles(result.screenshot, scale, result.height, MAX_TILES)
  } catch {
    return { findings: [], spentUsd, skipped: 'Could not read the screenshot', unchecked: 0 }
  }
  const rules = pickRules(detectFeatures(screen, result.tags))
  const answer = await counted(model, buildAsk({ tiles: slices, cands, rules, already: result.findings }))
  if (!answer.ok) return { findings: [], spentUsd, skipped: answer.error, unchecked: 0 }
  // After the first call works, so a run that is skipped prints a single line.
  const screens = Math.max(1, Math.ceil(result.pageHeight / result.height))
  if (screens > slices.length) log(`Review covered the first ${slices.length} screens of ${screens}`)
  const found = findingsFrom(answer.text, cands, rules)
    .map((f) => (source !== null && f.node ? { ...f, line: lineOf(source, f.node) } : f))
  // One at a time, so paid calls stay in order and the ledger sees each one.
  const kept: Finding[] = []
  const failures: string[] = []
  for (const f of found) {
    const crop = f.node ? cropPng(result.screenshot, f.node.box, scale) : null
    if (!crop) continue
    const reflection = await reflect(f, crop, excerpt(source, f.line), counted, model)
    if ('failed' in reflection) failures.push(reflection.failed)
    else if (reflection.kept) kept.push(reflection.kept)
  }
  if (failures.length > 0) log(`Review could not double-check ${failures.length} findings: ${failures[0]}`)
  return { findings: kept, spentUsd, skipped: null, unchecked: failures.length }
}
