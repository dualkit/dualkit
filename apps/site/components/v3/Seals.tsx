import { V3 } from '@/lib/v3/copy'
import { Ar } from './primitives'

import { GLYPHS } from '@/lib/v3/seal-glyphs'
function Glyph({ id }: { id: string }) {
  const d = GLYPHS[id]
  if (d === null) return <Ar><span className="v3-seal-ain">ع</span></Ar>
  return <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d={d} /></svg>
}

/** Six round seals for standards Dualkit follows, with the note that says none is a certification. */
export function Seals() {
  return (
    <div className="v3-seals-block">
      <ul className="v3-seals" aria-label="Standards Dualkit follows">
        {V3.seals.map(([big, small]) => (
          <li key={big} className="v3-seal">
            <span className="v3-seal-ring"><Glyph id={big} /></span>
            <span className="v3-seal-words"><span>{big}</span><span className="v3-seal-scope">{small}</span></span>
          </li>
        ))}
      </ul>
      <p className="v3-small v3-seals-note">{V3.sealNote}</p>
    </div>
  )
}
