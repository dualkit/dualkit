import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ROOT } from './config'
import type { Usage } from './providers'
import type { SlimFinding } from './score'

export type Condition = 'alone' | 'dualkit'
export type BuildKey = { month: string; model: string; screen: string; condition: Condition; run: number }
/** finish, reasoningTokens and servedModel come from the provider, and are null when a failure left no reply. */
export type BuildRecord = BuildKey & { at: string; reply: string | null; usage: Usage | null; ms: number; finish: string | null; reasoningTokens: number | null; servedModel: string | null }
  & ({ ok: true; rulesPassed: number; score: number; missing: string[]; findings: SlimFinding[]; unreadableStylesheets: number; pageHeight: number } | { ok: false; error: string })

export const RUNS_ROOT = join(ROOT, '..', '..', 'bench', 'runs')
const FILE = /^(alone|dualkit)-(\d+)\.json$/

const readRecord = (file: string): BuildRecord | null => {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as BuildRecord
  } catch {
    return null
  }
}
const dirs = (path: string) => (existsSync(path) ? readdirSync(path, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [])

export function makeStore(root = RUNS_ROOT) {
  const paths = (k: BuildKey) => {
    const base = join(root, k.month, k.model, k.screen, `${k.condition}-${k.run}`)
    return { json: `${base}.json`, html: `${base}.html`, webp: `${base}.webp` }
  }
  const read = (k: BuildKey) => readRecord(paths(k).json)
  return {
    paths,
    read,
    isDone: (k: BuildKey) => read(k)?.ok === true,
    write(rec: BuildRecord, html: string | null, shot: Buffer | null = null) {
      const p = paths(rec)
      mkdirSync(dirname(p.json), { recursive: true })
      // HTML and screenshot first, JSON last: the JSON marks the build done, so a crash in between leaves it to be redone.
      if (html !== null) writeFileSync(p.html, html)
      if (shot !== null) writeFileSync(p.webp, shot)
      writeFileSync(p.json, `${JSON.stringify(rec, null, 2)}\n`)
    },
    list(month: string): BuildRecord[] {
      const out: BuildRecord[] = []
      for (const model of dirs(join(root, month)).sort())
        for (const screen of dirs(join(root, month, model)).sort())
          for (const name of readdirSync(join(root, month, model, screen)).filter((n) => FILE.test(n)).sort()) {
            const rec = readRecord(join(root, month, model, screen, name))
            if (rec) out.push(rec)
          }
      return out
    },
  }
}
export type Store = ReturnType<typeof makeStore>
