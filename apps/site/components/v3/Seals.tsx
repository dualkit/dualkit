import { V3 } from '@/lib/v3/copy'
import { SEAL_MARKS, type SealMark } from '@/lib/v3/seal-glyphs'

const MARK_H = 36

function Mark({ mark }: { mark: SealMark }) {
  if (mark.kind === 'text') return <span className="v3-mono v3-seal-text" aria-hidden="true">{mark.text}</span>
  // OSI's guidelines ask for the mark to link to opensource.org.
  return (
    <a className="v3-seal-logo" href={mark.href} rel="noopener noreferrer" aria-label={mark.label}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mark.src} alt="" width={Math.round((MARK_H * mark.width) / mark.height)} height={MARK_H} loading="lazy" decoding="async" />
    </a>
  )
}

/** Six round seals for standards Dualkit follows, with the note that says none is a certification. */
export function Seals() {
  return (
    <div className="v3-seals-block">
      <ul className="v3-seals" aria-label="Standards Dualkit follows">
        {V3.seals.map(([big, small]) => {
          const mark = SEAL_MARKS[big]
          return (
            <li key={big} className="v3-seal">
              <span className="v3-seal-ring">{mark ? <Mark mark={mark} /> : null}</span>
              <span className="v3-seal-words"><span>{big}</span><span className="v3-seal-scope">{small}</span></span>
            </li>
          )
        })}
      </ul>
      <p className="v3-small v3-seals-note">{V3.sealNote}</p>
    </div>
  )
}
