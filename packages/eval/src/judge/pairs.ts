import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

export type Against = 'dualkit' | 'loop'
export type Pair = {
  id: string
  month: string
  model: string
  screen: string
  run: number
  against: Against
  aloneHtml: string
  otherHtml: string
}

const dirs = (path: string): string[] =>
  existsSync(path) ? readdirSync(path, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : []

const files = (path: string): Set<string> => new Set(readdirSync(path))

/** Pairs where both alone-<run>.html and <against>-<run>.html exist. Round files never match. */
export const listPairs = (runsDir: string, month: string, against: Against): Pair[] => {
  const base = resolve(runsDir, month)
  const pairs: Pair[] = []
  for (const model of dirs(base)) {
    for (const screen of dirs(join(base, model))) {
      const dir = join(base, model, screen)
      const present = files(dir)
      for (const name of present) {
        const m = /^alone-(\d+)\.html$/.exec(name)
        const other = m ? `${against}-${m[1]}.html` : ''
        if (!m || !present.has(other)) continue
        const run = Number(m[1])
        pairs.push({
          id: `${month}/${model}/${screen}/${run}/${against}`,
          month,
          model,
          screen,
          run,
          against,
          aloneHtml: join(dir, name),
          otherHtml: join(dir, other),
        })
      }
    }
  }
  return pairs.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}
