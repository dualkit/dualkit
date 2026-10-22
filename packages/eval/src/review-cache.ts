import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReviewResult } from '../../cli/src/review'
import type { VisionModel } from '../../cli/src/review/model'
import { REVIEW_PROMPT_VERSION } from '../../cli/src/review/prompt'

/** sha256 of the page, the model as `provider:model`, and the prompt version. A change to any of them is a new key. */
export function reviewKey(content: string, model: VisionModel): string {
  return createHash('sha256').update([content, `${model.provider}:${model.model}`, REVIEW_PROMPT_VERSION].join('\0')).digest('hex')
}

const isResult = (x: unknown): x is ReviewResult => {
  const r = x as Partial<ReviewResult> | null
  return !!r && Array.isArray(r.findings) && r.skipped === null && typeof r.spentUsd === 'number' && typeof r.unchecked === 'number'
}

function read(file: string): ReviewResult | null {
  try {
    const stored: unknown = JSON.parse(readFileSync(file, 'utf8'))
    return isResult(stored) ? stored : null
  } catch {
    // Missing or unreadable: run the review again.
    return null
  }
}

export type CachedReview = { result: ReviewResult; cached: boolean }

/** The stored review for this page and model, or a fresh one. Skipped results are never stored. */
export async function cachedReview(opts: { dir: string; content: string; model: VisionModel; run: () => Promise<ReviewResult> }): Promise<CachedReview> {
  const file = join(opts.dir, `${reviewKey(opts.content, opts.model)}.json`)
  const known = read(file)
  // A hit costs nothing now, whatever the first run spent.
  if (known) return { result: { ...known, spentUsd: 0 }, cached: true }
  const result = await opts.run()
  // A result with unchecked findings came from a flaky double-check, so it is run again next time.
  if (result.skipped === null && result.unchecked === 0) {
    mkdirSync(opts.dir, { recursive: true })
    writeFileSync(file, JSON.stringify(result))
  }
  return { result, cached: false }
}
