import { MAKER_MARKS } from '@/lib/marks'
import { makerInitial } from '@/lib/bench-view'

/** The maker's mark in one colour, or a square tile with the maker's initial for an id we have no mark for. */
export function MakerMark({ mark, by, size = 16 }: { mark: string; by: string; size?: number }) {
  const m = MAKER_MARKS[mark]
  if (!m) return <span className="bx-initial" style={{ width: size, height: size, fontSize: Math.round(size * 0.62) }} aria-hidden="true">{makerInitial(by)}</span>
  return (
    <svg className="bx-mark" width={size} height={size} viewBox={m.viewBox} aria-hidden="true">
      {m.paths.map((p) => <path key={p.d.slice(0, 24)} d={p.d} fill="currentColor" fillRule={p.evenOdd ? 'evenodd' : undefined} clipRule={p.evenOdd ? 'evenodd' : undefined} />)}
    </svg>
  )
}
