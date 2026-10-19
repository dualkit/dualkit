import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseBenchMonth, type BenchMonth } from './bench-schema'

const DIR = join(process.cwd(), 'content', 'bench')
/** The bench package, which holds the model list and the prompts the next run will use. */
const BENCH_PKG = join(process.cwd(), '..', '..', 'packages', 'bench')
const MONTH_FILE = /^(\d{4}-(?:0[1-9]|1[0-2]))\.json$/

export const listBenchMonths = (dir = DIR): string[] =>
  existsSync(dir) ? readdirSync(dir).map((f) => MONTH_FILE.exec(f)?.[1]).filter((m): m is string => !!m).sort().reverse() : []

/** A corrupt month throws, so a bad commit fails the deploy instead of showing wrong numbers. */
export function loadBenchMonth(month: string, dir = DIR): BenchMonth | null {
  if (!MONTH_FILE.test(`${month}.json`)) return null
  const file = join(dir, `${month}.json`)
  return existsSync(file) ? parseBenchMonth(JSON.parse(readFileSync(file, 'utf8'))) : null
}

export const latestBenchMonth = (dir = DIR): BenchMonth | null => {
  const [latest] = listBenchMonths(dir)
  return latest ? loadBenchMonth(latest, dir) : null
}

/** What the next run will cover, for the facts line before any month exists. Null when the package is not there. */
export function plannedBench(root = BENCH_PKG): { models: number; screens: number } | null {
  const models = join(root, 'models.json')
  const prompts = join(root, 'prompts')
  if (!existsSync(models) || !existsSync(prompts)) return null
  const list: unknown = JSON.parse(readFileSync(models, 'utf8'))
  if (!Array.isArray(list)) return null
  return { models: list.length, screens: readdirSync(prompts).filter((f) => f.endsWith('.json')).length }
}
