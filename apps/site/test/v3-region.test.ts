import { describe, expect, it } from 'vitest'
import { formatMoney } from '@dualkit/format'
import { cityExamples, runDir } from '../lib/v3/region-examples'
import { NEAR_RADIUS, PROXIMITY_ALPHA, arcPath, pickVia, proximityAlpha, selectReducer } from '../lib/v3/region-select'

const CITIES = ['Kuwait City', 'Riyadh', 'Manama', 'Doha', 'Abu Dhabi', 'Dubai', 'Muscat']

describe('city examples', () => {
  const ex = cityExamples(CITIES, new Date(Date.UTC(2026, 1, 18, 9)))
  it('has one example per city, in order', () => {
    expect(Object.keys(ex)).toEqual(CITIES)
  })
  it('reads Arabic-Indic digits typed in Kuwait City and gives three decimals', () => {
    expect(ex['Kuwait City']).toEqual({ from: '١٢٣٤٫٥', fromAr: true, to: formatMoney(1234.5, { currency: 'KWD' }), toAr: false })
    expect(ex['Kuwait City']!.to).toMatch(/^KWD\s1,234\.500$/)
  })
  it('gives the dinars and the rial three decimals and the riyal two', () => {
    expect(ex.Manama!.to).toMatch(/^BHD\s8\.750$/)
    expect(ex.Muscat!.to).toMatch(/^OMR\s3\.200$/)
    expect(ex.Doha!.to).toMatch(/^QAR\s150\.00$/)
  })
  it('shows the day in Riyadh on the Umm al-Qura calendar', () => {
    expect(ex.Riyadh!.from).toBe('2026-02-18')
    expect(ex.Riyadh!.to).toBe('١ رمضان ١٤٤٧ هـ')
  })
  it('reads a Dubai mobile typed in Arabic-Indic digits', () => {
    expect(ex.Dubai).toEqual({ from: '٠٥٠ ١٢٣ ٤٥٦٧', fromAr: true, to: '+971 50 123 4567', toAr: false })
  })
  it('throws for a city it has no example for', () => {
    expect(() => cityExamples(['Baghdad'])).toThrow(/Baghdad/)
  })
})

describe('map selection', () => {
  it('picks a city on enter and focus', () => {
    expect(selectReducer(null, { type: 'enter', city: 'Doha' })).toBe('Doha')
    expect(selectReducer('Doha', { type: 'focus', city: 'Muscat' })).toBe('Muscat')
  })
  it('lets go only of the city a leave or blur names', () => {
    expect(selectReducer('Doha', { type: 'leave', city: 'Doha' })).toBeNull()
    expect(selectReducer('Muscat', { type: 'leave', city: 'Doha' })).toBe('Muscat')
    expect(selectReducer('Muscat', { type: 'blur', city: 'Muscat' })).toBeNull()
  })
  it('toggles on tap', () => {
    expect(selectReducer(null, { type: 'tap', city: 'Riyadh' })).toBe('Riyadh')
    expect(selectReducer('Riyadh', { type: 'tap', city: 'Riyadh' })).toBeNull()
    expect(selectReducer('Riyadh', { type: 'tap', city: 'Doha' })).toBe('Doha')
    expect(selectReducer('Riyadh', { type: 'clear' })).toBeNull()
  })
})

describe('proximity', () => {
  it('leaves dots beyond the radius alone', () => {
    expect(proximityAlpha(0.3, NEAR_RADIUS)).toBe(0.3)
    expect(proximityAlpha(0.3, Infinity)).toBe(0.3)
  })
  it('darkens up to the peak at the pointer, more the closer it is', () => {
    expect(proximityAlpha(0.3, 0)).toBeCloseTo(PROXIMITY_ALPHA, 9)
    expect(proximityAlpha(0.3, 20)).toBeGreaterThan(proximityAlpha(0.3, 40))
    expect(proximityAlpha(0.3, 40)).toBeGreaterThan(0.3)
  })
  it('never lightens a dot already darker than the peak', () => {
    expect(proximityAlpha(0.95, 0)).toBe(0.95)
  })
})

describe('arc', () => {
  it('lifts the curve above the higher end', () => {
    expect(arcPath({ x: 100, y: 200 }, { x: 300, y: 100 }, 28)).toBe('M100 200Q200 72 300 100')
  })
  it('has no arc from a city to itself', () => {
    expect(arcPath({ x: 100, y: 200 }, { x: 100, y: 200 }, 28)).toBeNull()
  })
})

describe('run direction', () => {
  it('keeps a phone number in Arabic-Indic digits left to right and Arabic words right to left', () => {
    const ex = cityExamples(CITIES)
    expect(runDir(ex.Dubai!.from)).toBe('ltr')
    expect(runDir(ex['Abu Dhabi']!.to)).toBe('rtl')
    expect(runDir(ex.Riyadh!.to)).toBe('rtl')
  })
})

describe('pickVia', () => {
  it('reads focus as the keyboard, so a tabbed pick shows at once', () => {
    expect(pickVia({ type: 'focus', city: 'Doha' })).toBe('keyboard')
  })
  it('reads hover and tap as the pointer, so they keep their motion', () => {
    expect(pickVia({ type: 'enter', city: 'Doha' })).toBe('pointer')
    expect(pickVia({ type: 'tap', city: 'Doha' })).toBe('pointer')
  })
  it('leaves the last kind alone when a city is let go', () => {
    expect(pickVia({ type: 'leave', city: 'Doha' })).toBeNull()
    expect(pickVia({ type: 'blur', city: 'Doha' })).toBeNull()
    expect(pickVia({ type: 'clear' })).toBeNull()
  })
})
