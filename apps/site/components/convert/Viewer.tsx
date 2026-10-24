'use client'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { SHOT, shotSrc, type ProofScreen } from '@/lib/convert-proof'

type Lang = 'en' | 'ar'
type Device = 'desktop' | 'phone'

const LANGS: readonly (readonly [Lang, string])[] = [['en', 'English'], ['ar', 'العربية']]
const DEVICES: readonly (readonly [Device, string])[] = [['desktop', 'Desktop'], ['phone', 'Phone']]

/** A two-option switch. The thumb slides between options; arrow keys move it, as in a radio group. */
function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void }) {
  const index = options.findIndex(([v]) => v === value)
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    onChange(options[(index + 1) % options.length]![0])
  }
  return (
    <div className="cv-seg" role="radiogroup" aria-label={label} onKeyDown={onKey} style={{ '--i': index } as React.CSSProperties}>
      <span className="cv-seg-thumb" aria-hidden="true" />
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={v === value} tabIndex={v === value ? 0 : -1}
          lang={v === 'ar' ? 'ar' : undefined} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  )
}

/**
 * The before and after. Both languages of the chosen screen are stacked in one frame and cross-fade,
 * so a switch never reflows the page. Each shot is one screen of the page, top first.
 */
export function Viewer({ screens }: { screens: readonly ProofScreen[] }) {
  const [active, setActive] = useState(0)
  const [lang, setLang] = useState<Lang>('ar')
  const [device, setDevice] = useState<Device>('desktop')
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  // A phone visitor starts on the phone shots, which are legible at their width.
  useEffect(() => { if (matchMedia('(max-width: 820px)').matches) setDevice('phone') }, [])
  const screen = screens[active]!
  const size = SHOT[device]

  const onTabKey = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (active + step + screens.length) % screens.length
    setActive(next)
    tabs.current[next]?.focus()
  }

  return (
    <div className="cv-viewer" data-device={device}>
      <div className="cv-tabs" role="tablist" aria-label="Screens" aria-orientation="vertical" onKeyDown={onTabKey}>
        {screens.map((s, i) => (
          <button key={s.slug} ref={(el) => { tabs.current[i] = el }} type="button" role="tab" id={`cv-tab-${s.slug}`}
            aria-selected={i === active} aria-controls="cv-stage" tabIndex={i === active ? 0 : -1} onClick={() => setActive(i)}>
            <span>{s.name}</span>
            <span className="cv-tab-score" aria-label={`Check score ${s.score}`}>{s.score}</span>
          </button>
        ))}
      </div>
      <div className="cv-main">
        <div className="cv-bar">
          <Segmented label="Language" options={LANGS} value={lang} onChange={setLang} />
          <Segmented label="Device" options={DEVICES} value={device} onChange={setDevice} />
        </div>
        <div className="cv-stage" id="cv-stage" role="tabpanel" aria-labelledby={`cv-tab-${screen.slug}`}>
          <div className="cv-url small"><span className="faint">tailadmin</span>{lang === 'ar' ? `/ar${screen.path === '/' ? '' : screen.path}` : screen.path}</div>
          <div className="cv-frame" role="img" aria-label={`${screen.name}, ${lang === 'ar' ? 'Arabic' : 'English'}, ${device}`}
            style={{ aspectRatio: `${size.w} / ${size.h}` }}>
            {(['en', 'ar'] as const).map((l) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={`${screen.slug}-${device}-${l}`} src={shotSrc(screen.slug, l, device)} width={size.w} height={size.h}
                data-on={l === lang || undefined} alt="" decoding="async" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
