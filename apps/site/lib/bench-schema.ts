export type BenchFinding = { rule: string; title: string; severity: 'error' | 'warning' | 'note'; box: { x: number; y: number; width: number; height: number } | null }
export type BenchCell =
  | { ran: false; runs: number; reasons: string[] }
  | { ran: true; runs: number; rulesPassed: number; score: number; missing: string[]; findings: BenchFinding[]; shot: string | null; pageHeight: number; raw: string }
export type BenchTotal = { rulesPassed: number; outOf: number; score: number }
export type BenchModel = { id: string; label: string; provider: 'openrouter' | 'gemini'; by: string; mark: string; rank: number | null; previousRank: number | null
  /** Places moved since last month among models ranked in both months, positive for up; null when unranked now or not ranked then. */
  move: number | null; isNew: boolean; alone: BenchTotal | null; dualkit: BenchTotal | null; lift: number | null; screens: { id: string; title: string; alone: BenchCell; dualkit: BenchCell }[] }
export type BenchMonth = { month: string; generatedAt: string; ruleCount: number; models: BenchModel[] }

type Obj = Record<string, unknown>
const fail = (path: string): never => { throw new Error(`Bench data: bad ${path}`) }
const obj = (v: unknown, path: string): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : fail(path))
const num = (v: unknown, path: string): number => (typeof v === 'number' && Number.isFinite(v) ? v : fail(path))
const str = (v: unknown, path: string): string => (typeof v === 'string' ? v : fail(path))
const bool = (v: unknown, path: string): boolean => (typeof v === 'boolean' ? v : fail(path))
const list = (v: unknown, path: string): unknown[] => (Array.isArray(v) ? v : fail(path))
const SEVERITIES = ['error', 'warning', 'note']

function total(v: unknown, path: string): BenchTotal | null {
  if (v === null) return null
  const o = obj(v, path)
  return { rulesPassed: num(o.rulesPassed, `${path}.rulesPassed`), outOf: num(o.outOf, `${path}.outOf`), score: num(o.score, `${path}.score`) }
}

function finding(v: unknown, path: string): BenchFinding {
  const o = obj(v, path)
  if (!SEVERITIES.includes(String(o.severity))) fail(`${path}.severity`)
  const box = o.box === null ? null : obj(o.box, `${path}.box`)
  return {
    rule: str(o.rule, `${path}.rule`), title: str(o.title, `${path}.title`), severity: o.severity as BenchFinding['severity'],
    box: box && { x: num(box.x, `${path}.box.x`), y: num(box.y, `${path}.box.y`), width: num(box.width, `${path}.box.width`), height: num(box.height, `${path}.box.height`) },
  }
}

function cell(v: unknown, path: string): BenchCell {
  const o = obj(v, path)
  const runs = num(o.runs, `${path}.runs`)
  if (!bool(o.ran, `${path}.ran`)) return { ran: false, runs, reasons: list(o.reasons, `${path}.reasons`).map((r, i) => str(r, `${path}.reasons.${i}`)) }
  return {
    ran: true, runs, rulesPassed: num(o.rulesPassed, `${path}.rulesPassed`), score: num(o.score, `${path}.score`),
    missing: list(o.missing, `${path}.missing`).map((m, i) => str(m, `${path}.missing.${i}`)),
    findings: list(o.findings, `${path}.findings`).map((f, i) => finding(f, `${path}.findings.${i}`)),
    shot: o.shot === null ? null : str(o.shot, `${path}.shot`), pageHeight: num(o.pageHeight, `${path}.pageHeight`), raw: str(o.raw, `${path}.raw`),
  }
}

export function parseBenchMonth(raw: unknown): BenchMonth {
  const o = obj(raw, 'month file')
  const month = str(o.month, 'month')
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) fail('month')
  return {
    month, generatedAt: str(o.generatedAt, 'generatedAt'), ruleCount: num(o.ruleCount, 'ruleCount'),
    models: list(o.models, 'models').map((mv, i) => {
      const m = obj(mv, `models.${i}`)
      if (m.provider !== 'openrouter' && m.provider !== 'gemini') fail(`models.${i}.provider`)
      return {
        by: str(m.by, `models.${i}.by`), mark: str(m.mark, `models.${i}.mark`),
        rank: m.rank === null ? null : num(m.rank, `models.${i}.rank`), previousRank: m.previousRank === null ? null : num(m.previousRank, `models.${i}.previousRank`),
        move: m.move === null ? null : num(m.move, `models.${i}.move`),
        id: str(m.id, `models.${i}.id`), label: str(m.label, `models.${i}.label`), provider: m.provider as BenchModel['provider'],
        isNew: bool(m.isNew, `models.${i}.isNew`), alone: total(m.alone, `models.${i}.alone`), dualkit: total(m.dualkit, `models.${i}.dualkit`),
        lift: m.lift === null ? null : num(m.lift, `models.${i}.lift`),
        screens: list(m.screens, `models.${i}.screens`).map((sv, j) => {
          const s = obj(sv, `models.${i}.screens.${j}`)
          const p = `models.${i}.screens.${j}`
          return { id: str(s.id, `${p}.id`), title: str(s.title, `${p}.title`), alone: cell(s.alone, `${p}.alone`), dualkit: cell(s.dualkit, `${p}.dualkit`) }
        }),
      }
    }),
  }
}
