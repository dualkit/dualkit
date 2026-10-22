import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { RUN } from '@dualkit/bench/src/config'
import { audit, type AuditResult } from '../../cli/src/audit'
import { review, type ReviewResult, type Vision } from '../../cli/src/review'
import { DEFAULT_REVIEW_MODEL, fileLedger, makeVision, type Ledger, type VisionModel } from '../../cli/src/review/model'
import { cachedReview } from './review-cache.js'

export const OUT = fileURLToPath(new URL('../out/', import.meta.url))
export const REVIEW_CAP_USD = 3
const KEY_NAME: Record<VisionModel['provider'], string> = { openrouter: 'OPENROUTER_API_KEY', gemini: 'GEMINI_API_KEY' }

/** One ledger file per UTC month inside the package, wherever the command runs from. */
export const ledgerPath = (now: Date = new Date()): string => join(OUT, `spend-${now.toISOString().slice(0, 7)}.json`)

/** The last line of a run log. */
export const spendLine = (ledger: Ledger): string =>
  `Spent $${ledger.spent().toFixed(2)} of $${(ledger.capUsd ?? REVIEW_CAP_USD).toFixed(2)} this month`

export type Reviewer = {
  model: VisionModel
  ledger: Ledger
  /** Reviews a rendered page. `content` is what the cache is keyed on: the page's html, or for a recorded page its screenshot. */
  run: (result: AuditResult, content: string) => Promise<ReviewResult>
  /** Renders a page from html, then reviews it. */
  runHtml: (html: string) => Promise<ReviewResult>
}

const skipped = (why: string): ReviewResult => ({ findings: [], spentUsd: 0, skipped: why, unchecked: 0 })

async function auditHtml(html: string): Promise<AuditResult> {
  const dir = mkdtempSync(join(tmpdir(), 'eval-review-'))
  try {
    const file = join(dir, 'index.html')
    writeFileSync(file, html)
    return await audit({ url: pathToFileURL(file).href, width: RUN.width, height: RUN.height, config: { ignore: [], exclude: [] } }, () => chromium.launch())
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

type Options = { env: NodeJS.ProcessEnv; log: (line: string) => void; vision?: Vision; ledger?: Ledger; cacheDir?: string; model?: VisionModel }

/**
 * The reviewer the eval uses: cached on disk, capped by a monthly ledger. With no key it still answers from the cache,
 * and a page it has never reviewed comes back skipped before anything is rendered.
 */
export function makeReviewer({ env, log, vision, ledger = fileLedger(ledgerPath(), REVIEW_CAP_USD), cacheDir = join(OUT, 'review-cache'), model = DEFAULT_REVIEW_MODEL }: Options): Reviewer {
  const ask: Vision = vision ?? makeVision({ env, ledger })
  const run = async (result: AuditResult, content: string): Promise<ReviewResult> => {
    const { result: out, cached } = await cachedReview({
      dir: cacheDir, content, model,
      run: () => review(result, { source: null, vision: ask, model, log }),
    })
    if (cached) log('Review result taken from the cache')
    return out
  }
  const runHtml = async (html: string): Promise<ReviewResult> => {
    const missingKey = env[KEY_NAME[model.provider]] ? null : `No ${KEY_NAME[model.provider]}`
    if (vision === undefined && missingKey) {
      // Only the cache can answer, and a miss must not cost a render.
      return (await cachedReview({ dir: cacheDir, content: html, model, run: async () => skipped(missingKey) })).result
    }
    const { result: out, cached } = await cachedReview({
      dir: cacheDir, content: html, model,
      run: async () => review(await auditHtml(html), { source: null, vision: ask, model, log }),
    })
    if (cached) log('Review result taken from the cache')
    return out
  }
  return { model, ledger, run, runHtml }
}
