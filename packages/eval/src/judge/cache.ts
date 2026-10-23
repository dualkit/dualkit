import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PairVerdict } from './judge.js'

export type JudgeCache = { get(key: string): PairVerdict | null; put(key: string, verdict: PairVerdict): void }

/** sha256 over both pages, the model id and the prompt version, so any change asks again. */
export const cacheKey = (parts: { aloneHtml: string; otherHtml: string; model: string; version: string }): string =>
  createHash('sha256').update(JSON.stringify([parts.aloneHtml, parts.otherHtml, parts.model, parts.version])).digest('hex')

const isVerdict = (v: unknown): v is PairVerdict => {
  const x = v as Partial<PairVerdict> | null
  return !!x && typeof x.winner === 'string' && x.winner !== 'failed' && typeof x.byDefault === 'boolean' && Array.isArray(x.calls)
}

/** One json file per key. Failed verdicts are never stored, and a corrupt file reads as a miss. */
export function fileJudgeCache(dir: string): JudgeCache {
  return {
    get(key) {
      const file = join(dir, `${key}.json`)
      if (!existsSync(file)) return null
      try {
        const v: unknown = JSON.parse(readFileSync(file, 'utf8'))
        return isVerdict(v) ? v : null
      } catch {
        return null
      }
    },
    put(key, verdict) {
      if (verdict.winner === 'failed') return
      mkdirSync(dir, { recursive: true })
      const file = join(dir, `${key}.json`)
      const temp = `${file}.${process.pid}.tmp`
      writeFileSync(temp, JSON.stringify(verdict))
      renameSync(temp, file)
    },
  }
}
