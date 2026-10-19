import type { BenchMonth } from '../bench-schema'
import { trackOf } from '../bench-view'
import { V3 } from './copy'

export type BenchTeaserRow = { name: string; maker: string; alone: number; dualkit: number }

const TEASER_ROWS = 4

/** The four rows the home page shows: the month's top four ranked models, or the sample rows until a month exists. */
export function benchRows(month: BenchMonth | null): { rows: BenchTeaserRow[]; sample: boolean } {
  const ranked = (month?.models ?? [])
    .flatMap((m) => {
      const track = trackOf(m)
      return track ? [{ name: m.label, maker: m.mark, alone: Math.round(track.alone), dualkit: Math.round(track.dualkit), rank: m.rank ?? Infinity }] : []
    })
    .sort((a, b) => a.rank - b.rank)
    .slice(0, TEASER_ROWS)
    .map(({ rank: _rank, ...row }) => row)
  if (ranked.length === 0) return { rows: V3.bench.rows.map(([name, maker, alone, dualkit]) => ({ name, maker, alone, dualkit })), sample: true }
  return { rows: ranked, sample: false }
}
