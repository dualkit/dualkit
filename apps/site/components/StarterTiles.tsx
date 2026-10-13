'use client'
import { Amount, Button, DateDisplay, DigitInput, Field, Tabs, Toast } from '@dualkit/starter/components'
import { useState, type ReactNode } from 'react'
import { flip, shown, type FlipState, type Lang, type Pointer } from '@/lib/tile-flip'

// The lines inside the components, as in the approved "Dualkit Starter" Figma file.
const L = {
  next: { en: 'Continue', ar: 'متابعة' },
  email: { en: 'Email', ar: 'البريد الإلكتروني' },
  help: { en: 'We only use it to send receipts.', ar: 'نستخدمه لإرسال الإيصالات فقط.' },
  code: { en: 'Verification code', ar: 'رمز التحقق' },
  total: { en: 'Total due', ar: 'المبلغ المستحق' },
  vat: { en: 'Including 5% VAT', ar: 'شامل ضريبة القيمة المضافة ٥٪' },
  tabs: { en: ['Overview', 'Payments', 'Settings'], ar: ['نظرة عامة', 'المدفوعات', 'الإعدادات'] },
  sheet: { en: 'Payment details', ar: 'تفاصيل الدفع' },
  rows: { en: [['Amount', 'AED 1,250.00'], ['Reference', 'INV-2041']], ar: [['المبلغ', '١٬٢٥٠٫٠٠ د.إ'], ['المرجع', 'INV-2041']] },
  pay: { en: 'Pay now', ar: 'ادفع الآن' },
  toast: { en: 'Payment sent.', ar: 'تم الدفع.' },
  undo: { en: 'Undo', ar: 'تراجع' },
} as const

// A fixed instant, so the server and the browser print the same date.
const DUE = new Date('2026-10-13T08:00:00Z')
const noop = () => {}

function SheetPreview({ l }: { l: Lang }) {
  return (
    <div className="st-sheet">
      <p className="dk-title">{L.sheet[l]}</p>
      <div className="st-sheet__rows">
        {L.rows[l].map(([k, v], i) => (
          <div key={k} className="dk-sheet__row">
            <span className="dk-caption dk-secondary">{k}</span>
            {i === 0 && l === 'ar' ? <bdi className="dk-body">{v}</bdi> : <span className="dk-mono" dir="ltr">{v}</span>}
          </div>
        ))}
      </div>
      <div className="st-sheet__actions"><Button icon="forward" tabIndex={-1}>{L.pay[l]}</Button></div>
    </div>
  )
}

type Tile = { name: string; base: Lang; render: (l: Lang) => ReactNode }

const TILES: Tile[] = [
  { name: 'Button', base: 'en', render: (l) => <Button icon="forward" tabIndex={-1}>{L.next[l]}</Button> },
  { name: 'Field', base: 'ar', render: (l) => <Field label={L.email[l]} help={L.help[l]} defaultValue="sam@dualkit.dev" readOnly tabIndex={-1} /> },
  { name: 'Digit input', base: 'en', render: (l) => <DigitInput label={L.code[l]} locale={l} defaultValue="482" /> },
  { name: 'Amount', base: 'ar', render: (l) => <Amount amount={1250} currency="AED" locale={l} label={L.total[l]} note={L.vat[l]} /> },
  { name: 'Date', base: 'ar', render: (l) => <DateDisplay date={DUE} locale={l} /> },
  { name: 'Tabs', base: 'ar', render: (l) => <Tabs label={L.sheet[l]} items={L.tabs[l].map((label, i) => ({ id: String(i), label, panel: null }))} defaultValue="0" /> },
  { name: 'Sheet', base: 'en', render: (l) => <SheetPreview l={l} /> },
  { name: 'Toast', base: 'ar', render: (l) => <Toast tone="success" message={L.toast[l]} action={{ label: L.undo[l], onAction: noop }} /> },
]

const NAMES = { en: 'English', ar: 'Arabic' } as const

function StarterTile({ tile }: { tile: Tile }) {
  const [state, setState] = useState<FlipState>({ peek: false, pinned: false })
  const [pointer, setPointer] = useState<Pointer>('keyboard')
  const lang = shown(tile.base, state)
  const send = (e: Parameters<typeof flip>[1]) => setState((s) => flip(s, e))
  const kind = (t: string): Pointer => (t === 'touch' ? 'touch' : t === 'pen' ? 'pen' : 'mouse')

  return (
    // A div with the button role, because the real components inside it are buttons and inputs themselves.
    <div
      role="button"
      tabIndex={0}
      className="st-tile"
      aria-pressed={lang !== tile.base}
      aria-label={`${tile.name}, shown in ${NAMES[lang]}`}
      onPointerEnter={(e) => send({ type: 'enter', pointer: kind(e.pointerType) })}
      onPointerLeave={(e) => send({ type: 'leave', pointer: kind(e.pointerType) })}
      onPointerDown={(e) => setPointer(kind(e.pointerType))}
      onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) send({ type: 'focus' }) }}
      onBlur={() => send({ type: 'blur' })}
      onClick={() => send({ type: 'activate', pointer })}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        send({ type: 'activate', pointer: 'keyboard' })
      }}
    >
      <span className="st-stage">
        {(['en', 'ar'] as const).map((l) => (
          <span key={l} className="st-layer" lang={l} dir={l === 'ar' ? 'rtl' : 'ltr'} data-on={l === lang} aria-hidden="true" inert>
            {tile.render(l)}
          </span>
        ))}
      </span>
      <span className="st-name">{tile.name}</span>
    </div>
  )
}

export function StarterTiles() {
  return <div className="st-grid">{TILES.map((t) => <StarterTile key={t.name} tile={t} />)}</div>
}
