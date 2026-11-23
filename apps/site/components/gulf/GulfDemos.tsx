'use client'

import { NATIONAL_ID_COUNTRIES, NATIONAL_ID_EXAMPLES, parseIban, parseNationalId, type GulfCountry, type NationalIdCountry } from '@dualkit/format'
import { GulfAmount, readGulfAmount } from '@dualkit/starter/gulf/gulf-amount'
import { GulfHijriDate, readGulfDate } from '@dualkit/starter/gulf/gulf-hijri-date'
import { GulfIbanInput } from '@dualkit/starter/gulf/gulf-iban-input'
import { GulfNationalIdInput } from '@dualkit/starter/gulf/gulf-national-id-input'
import { GulfPhoneInput, readGulfPhone } from '@dualkit/starter/gulf/gulf-phone-input'
import { useState, type ReactNode } from 'react'
import { GULF_COPY as C, type GulfSlug } from '@/lib/gulf-copy'

type Lang = 'en' | 'ar'
const TIME_ZONE = 'Asia/Dubai'

/** A value and the last result onResult handed back, seeded from the same format call. */
function useDemo<R>(initial: string, read: (value: string) => R) {
  const [value, onChange] = useState(initial)
  const [result, onResult] = useState<R>(() => read(initial))
  return { value, onChange, result, onResult }
}

/** One language: the component in its own direction, with the result under it, always left to right. */
function Pane({ lang, result, children }: { lang: Lang; result: unknown; children: ReactNode }) {
  return (
    <div className="card gulf-pane" dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang}>
      <span className="small soft" lang="en" dir="ltr">{lang === 'ar' ? C.arabic : C.english}</span>
      {children}
      <div className="gulf-result" dir="ltr" lang="en">
        <span>{C.result}: </span>
        <code>{JSON.stringify(result)}</code>
      </div>
    </div>
  )
}

function PhoneDemo({ lang }: { lang: Lang }) {
  const t = C.items['gulf-phone-input'][lang]
  const [country, setCountry] = useState<GulfCountry>(lang === 'ar' ? 'SA' : 'AE')
  const demo = useDemo(lang === 'ar' ? '055 123 4567' : '50 123 4567', (v) => readGulfPhone(v, country))
  return (
    <Pane lang={lang} result={demo.result}>
      <GulfPhoneInput label={t.label} countryLabel={t.country} help={t.help} errorMessages={t.errors}
        value={demo.value} onChange={demo.onChange} onResult={demo.onResult}
        country={country} onCountryChange={setCountry} numerals={lang === 'ar' ? 'arab' : 'latn'} />
    </Pane>
  )
}

function IbanDemo({ lang }: { lang: Lang }) {
  const t = C.items['gulf-iban-input'][lang]
  const demo = useDemo(lang === 'ar' ? 'SA0380000000608010167519' : 'AE070331234567890123456', (v) => parseIban(v))
  return (
    <Pane lang={lang} result={demo.result}>
      <GulfIbanInput label={t.label} help={t.help} errorMessages={t.errors} value={demo.value} onChange={demo.onChange} onResult={demo.onResult} />
    </Pane>
  )
}

/** The country picker sits outside the input, the way a form would ask for nationality or residence first. */
function NationalIdDemo({ lang }: { lang: Lang }) {
  const t = C.items['gulf-national-id-input'][lang]
  const [country, setCountry] = useState<NationalIdCountry>(lang === 'ar' ? 'SA' : 'AE')
  const initial = lang === 'ar' ? '1012345672' : '784199012345676'
  const demo = useDemo(initial, (v) => parseNationalId(v, country))
  // A new country starts from its own example, so the demo shows a valid number rather than a trimmed one.
  const pick = (next: NationalIdCountry) => {
    setCountry(next)
    demo.onChange(NATIONAL_ID_EXAMPLES[next])
  }
  return (
    <Pane lang={lang} result={demo.result}>
      <label className="gulf-country">
        <span>{t.country}</span>
        <select value={country} onChange={(e) => pick(e.target.value as NationalIdCountry)}>
          {NATIONAL_ID_COUNTRIES.map((c) => <option key={c} value={c}>{t.countries[c]}</option>)}
        </select>
      </label>
      <GulfNationalIdInput label={t.label} help={t.help[country]} errorMessages={t.errors} value={demo.value} onChange={demo.onChange}
        onResult={demo.onResult} country={country} numerals={lang === 'ar' ? 'arab' : 'latn'} />
    </Pane>
  )
}

function AmountDemo({ lang }: { lang: Lang }) {
  const t = C.items['gulf-amount'][lang]
  const options = { currency: 'KWD', locale: lang, numerals: lang === 'ar' ? 'arab' : 'latn' } as const
  const demo = useDemo('1250.125', (v) => readGulfAmount(v, options))
  return (
    <Pane lang={lang} result={demo.result}>
      <GulfAmount label={t.label} help={t.help} errorMessages={t.errors} {...options} value={demo.value} onChange={demo.onChange} onResult={demo.onResult} />
    </Pane>
  )
}

function HijriDemo({ lang }: { lang: Lang }) {
  const t = C.items['gulf-hijri-date'][lang]
  const demo = useDemo('2026-10-13', (v) => readGulfDate(v, { timeZone: TIME_ZONE }))
  return (
    <Pane lang={lang} result={demo.result}>
      <GulfHijriDate label={t.label} help={t.help} errorMessages={t.errors} calendarLabels={{ gregorian: t.gregorian, hijri: t.hijri }}
        timeZone={TIME_ZONE} locale={lang} numerals={lang === 'ar' ? 'arab' : 'latn'}
        value={demo.value} onChange={demo.onChange} onResult={demo.onResult} />
    </Pane>
  )
}

const DEMOS: Record<GulfSlug, (props: { lang: Lang }) => ReactNode> = {
  'gulf-phone-input': PhoneDemo,
  'gulf-iban-input': IbanDemo,
  'gulf-national-id-input': NationalIdDemo,
  'gulf-amount': AmountDemo,
  'gulf-hijri-date': HijriDemo,
}

/** The English and Arabic demos for one component, side by side. */
export function GulfDemo({ slug }: { slug: GulfSlug }) {
  const Demo = DEMOS[slug]
  return (
    <div className="gulf-demo gulf-grid">
      <Demo lang="en" />
      <Demo lang="ar" />
    </div>
  )
}
