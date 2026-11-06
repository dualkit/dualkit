import {
  isValidEmiratesId, isValidSaudiPhone, isValidUaePhone, parseIban, toHijri, toWesternDigits,
} from '@dualkit/format'
import { describe, expect, it } from 'vitest'
import { SAMPLE_KINDS, fillPlan, kindForLayerName, sample, type SampleKind, type SampleStyle } from '../src/samples'
import { mulberry32, seedFor } from '../src/random'

const STYLES: SampleStyle[] = [
  { locale: 'en', numerals: 'latn' },
  { locale: 'ar', numerals: 'latn' },
  { locale: 'ar', numerals: 'arab' },
]
const SEEDS = Array.from({ length: 60 }, (_, i) => i * 7919 + 1)

const ARABIC_INDIC = /[٠-٩]/
const WESTERN = /[0-9]/

/** The amount in minor units read back from formatted text, ignoring group separators. */
const amountOf = (s: string): number => Number((/[0-9][0-9,٬]*[.٫][0-9]+/.exec(toWesternDigits(s))?.[0] ?? '').replace(/[,٬]/g, '').replace('٫', '.'))

describe('sample', () => {
  for (const style of STYLES) {
    const label = `${style.locale}/${style.numerals}`

    it(`UAE phones pass the UAE validator (${label})`, () => {
      for (const seed of SEEDS) expect(isValidUaePhone(sample('phone-ae', seed, style))).toBe(true)
    })

    it(`Saudi phones pass the Saudi validator (${label})`, () => {
      for (const seed of SEEDS) expect(isValidSaudiPhone(sample('phone-sa', seed, style))).toBe(true)
    })

    it(`IBANs pass the IBAN validator for their country (${label})`, () => {
      for (const seed of SEEDS) {
        expect(parseIban(sample('iban-ae', seed, style), { country: 'AE' }).ok).toBe(true)
        expect(parseIban(sample('iban-sa', seed, style), { country: 'SA' }).ok).toBe(true)
      }
    })

    it(`Emirates IDs pass the Emirates ID validator (${label})`, () => {
      for (const seed of SEEDS) expect(isValidEmiratesId(sample('emirates-id', seed, style))).toBe(true)
    })

    it(`amounts show the right currency and decimals (${label})`, () => {
      for (const seed of SEEDS) {
        const aed = sample('amount-aed', seed, style)
        const kwd = sample('amount-kwd', seed, style)
        const sar = sample('amount-sar', seed, style)
        expect(aed).toContain(style.locale === 'ar' ? 'د.إ' : 'AED')
        expect(sar).toContain(style.locale === 'ar' ? 'ر.س' : 'SAR')
        expect(kwd).toContain(style.locale === 'ar' ? 'د.ك' : 'KWD')
        expect(toWesternDigits(aed)).toMatch(/[.٫]\d{2}(?!\d)/)
        expect(toWesternDigits(kwd)).toMatch(/[.٫]\d{3}(?!\d)/)
        expect(amountOf(aed)).toBeGreaterThan(0)
      }
    })

    it(`Hijri dates agree with toHijri for the same day (${label})`, () => {
      for (const seed of SEEDS) {
        const { gregorian, hijri } = { gregorian: sample('date-gregorian', seed, style), hijri: sample('date-hijri', seed, style) }
        const date = new Date(`${toWesternDigits(gregorian).split('/').reverse().join('-')}T12:00:00Z`)
        if (style.locale === 'en') continue
        const h = toHijri(date, { timeZone: 'Asia/Riyadh' })
        expect(toWesternDigits(hijri)).toContain(`${h.day} `)
        expect(toWesternDigits(hijri)).toContain(` ${h.year} `)
      }
    })

    it(`every digit uses the chosen numerals (${label})`, () => {
      for (const kind of SAMPLE_KINDS) {
        const s = sample(kind, 42, style)
        if (style.numerals === 'arab') expect(s).not.toMatch(WESTERN)
        else expect(s).not.toMatch(ARABIC_INDIC)
      }
    })
  }

  it('writes English dates in words and Arabic Gregorian dates with slashes', () => {
    expect(sample('date-gregorian', 3, { locale: 'en', numerals: 'latn' })).toMatch(/^\d{1,2} [A-Z][a-z]+ 20\d\d$/)
    expect(sample('date-gregorian', 3, { locale: 'ar', numerals: 'latn' })).toMatch(/^\d{2}\/\d{2}\/20\d\d$/)
    expect(sample('date-hijri', 3, { locale: 'en', numerals: 'latn' })).toMatch(/ AH$/)
  })

  it('is repeatable: the same seed gives the same sample', () => {
    for (const kind of SAMPLE_KINDS) expect(sample(kind, 1234, STYLES[0]!)).toBe(sample(kind, 1234, STYLES[0]!))
  })

  it('varies with the seed', () => {
    for (const kind of SAMPLE_KINDS) {
      const values = new Set(SEEDS.map((s) => sample(kind, s, STYLES[0]!)))
      expect(values.size).toBeGreaterThan(10)
    }
  })
})

describe('kindForLayerName', () => {
  const cases: Array<[string, SampleKind | null]> = [
    ['Phone', 'phone-ae'], ['Mobile number', 'phone-ae'], ['tel / KSA', 'phone-sa'], ['Saudi phone', 'phone-sa'], ['رقم الجوال', 'phone-ae'],
    ['IBAN', 'iban-ae'], ['iban sa', 'iban-sa'], ['Emirates ID', 'emirates-id'], ['EID', 'emirates-id'],
    ['Price', 'amount-aed'], ['Total SAR', 'amount-sar'], ['Balance KWD', 'amount-kwd'], ['Amount', 'amount-aed'],
    ['Hijri date', 'date-hijri'], ['Date', 'date-gregorian'], ['Title', null], ['Valid until', null],
  ]
  for (const [name, kind] of cases) it(`reads "${name}" as ${kind}`, () => expect(kindForLayerName(name)).toBe(kind))
})

describe('fillPlan', () => {
  const layers = [
    { id: '1:1', name: 'Phone' }, { id: '1:2', name: 'Title' }, { id: '1:3', name: 'Body' }, { id: '1:4', name: 'IBAN' },
  ]
  const options = { seed: 7, locale: 'en', numerals: 'latn', kind: 'auto' } as const

  it('picks a kind from each layer name and cycles through kinds for the rest', () => {
    const plan = fillPlan(layers, options)
    expect(plan.map((p) => p.id)).toEqual(['1:1', '1:2', '1:3', '1:4'])
    expect(plan[0]!.kind).toBe('phone-ae')
    expect(plan[3]!.kind).toBe('iban-ae')
    expect(plan[1]!.kind).not.toBe(plan[2]!.kind)
    for (const p of plan) expect(p.text.length).toBeGreaterThan(0)
  })

  it('uses one kind for every layer when asked', () => {
    const plan = fillPlan(layers, { ...options, kind: 'emirates-id' })
    expect(plan.every((p) => p.kind === 'emirates-id' && isValidEmiratesId(p.text))).toBe(true)
    expect(new Set(plan.map((p) => p.text)).size).toBe(4)
  })

  it('is repeatable for the same seed and layers', () => {
    expect(fillPlan(layers, options)).toEqual(fillPlan(layers, options))
    expect(fillPlan(layers, options)).not.toEqual(fillPlan(layers, { ...options, seed: 8 }))
  })
})

describe('random', () => {
  it('returns numbers in [0, 1) and repeats for a seed', () => {
    const a = mulberry32(5)
    const b = mulberry32(5)
    for (let i = 0; i < 100; i += 1) {
      const v = a()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
      expect(b()).toBe(v)
    }
  })

  it('derives distinct seeds per layer', () => {
    expect(seedFor(1, 0)).not.toBe(seedFor(1, 1))
    expect(seedFor(1, 0)).toBe(seedFor(1, 0))
  })
})
