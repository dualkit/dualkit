import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BenchError, loadModels, loadScreens, ROOT, SCREENS } from '../src/config'

const tmp = () => mkdtempSync(join(tmpdir(), 'bench-'))

describe('loadModels', () => {
  it('loads the committed list with unique ids', () => {
    const models = loadModels()
    expect(models.length).toBeGreaterThanOrEqual(5)
    expect(new Set(models.map((m) => m.id)).size).toBe(models.length)
  })
  it('gives every committed model a maker and a mark that exists in design/assets/marks', () => {
    for (const m of loadModels()) {
      expect(m.by.length).toBeGreaterThan(0)
      expect(readdirSync(join(ROOT, '..', '..', 'design', 'assets', 'marks'))).toContain(`${m.mark}.svg`)
    }
  })
  it('maps each committed model to its maker', () => {
    const by = Object.fromEntries(loadModels().map((m) => [m.id, `${m.by}/${m.mark}`]))
    expect(by).toEqual({
      'gemini-flash': 'Google/google', 'gemini-flash-lite': 'Google/google', 'nemotron-3-super': 'NVIDIA/nvidia',
      'dots-3-note': 'Dots Studio/dots-studio', 'laguna-s': 'Poolside/poolside', 'minimax-m3.1-flash': 'MiniMax/minimax',
    })
  })
  it('rejects a model without by, or with a mark that is not a file in design/assets/marks', () => {
    const base = { id: 'x', provider: 'gemini', model: 'x', label: 'X', since: '2026-11', by: 'Google', mark: 'google' }
    const load = (patch: Record<string, unknown>) => {
      const file = join(tmp(), 'm.json')
      writeFileSync(file, JSON.stringify([{ ...base, ...patch }]))
      return () => loadModels(file)
    }
    expect(load({})).not.toThrow()
    expect(load({ by: '' })).toThrow(/by/)
    expect(load({ by: undefined })).toThrow(/by/)
    expect(load({ mark: undefined })).toThrow(/mark/)
    expect(load({ mark: 'acme' })).toThrow(/mark/)
    expect(load({ mark: '../google' })).toThrow(/mark/)
  })
  it('rejects an unknown provider', () => {
    const file = join(tmp(), 'm.json')
    writeFileSync(file, JSON.stringify([{ id: 'x', provider: 'openai', model: 'x', label: 'X', since: '2026-11' }]))
    expect(() => loadModels(file)).toThrow(BenchError)
  })
  it('rejects a bad since month', () => {
    const file = join(tmp(), 'm.json')
    writeFileSync(file, JSON.stringify([{ id: 'x', provider: 'gemini', model: 'x', label: 'X', since: 'Nov' }]))
    expect(() => loadModels(file)).toThrow(/since/)
  })
})

const SAMPLES: Record<string, Record<string, string>> = {
  checkout: { 'AED prices': 'المجموع 45.00 AED' },
  'support-chat': { 'order number': 'رقم الطلب TX-48213 جاهز', 'English terms': 'فعّلت eSIM على هاتفي' },
  booking: { 'calendar days': 'السبت 20 الأحد 21 ... 30 31', 'time slots': 'المواعيد 9:00 9:30 10:00 10:30 11:00 11:30' },
  settings: { 'phone number': 'رقم الجوال +973 3600 1234' },
  transactions: { 'eight transactions': Array.from({ length: 8 }, (_, i) => `تاجر ${i} ${i + 1}.250 ر.ع`).join('\n'), 'OMR amounts': 'المبلغ 12.500 OMR', 'three decimals': '12.500', 'English merchant': 'Netflix اشتراك' },
}

describe('loadScreens', () => {
  it('loads all ten screens in order, each with a prompt and required parts', () => {
    const screens = loadScreens()
    expect(screens.map((s) => s.id)).toEqual([...SCREENS])
    for (const s of screens) {
      expect(s.prompt.length).toBeGreaterThan(100)
      expect(s.required.length).toBeGreaterThan(0)
      for (const r of s.required) expect(r.selector ?? r.text).toBeTruthy()
    }
  })
  it('loads ten screens in order', () => {
    expect(loadScreens().map((s) => s.id)).toEqual(['payment-summary', 'otp', 'address-form', 'profile', 'order-history', 'checkout', 'support-chat', 'booking', 'settings', 'transactions'])
  })
  it.each(Object.entries(SAMPLES))('%s: every required text pattern is valid and matches a good Arabic sample', (id, lines) => {
    const screen = loadScreens().find((s) => s.id === id)!
    const texts = screen.required.filter((r) => r.text)
    expect(texts.length).toBe(Object.keys(lines).length)
    for (const r of texts) {
      expect(() => new RegExp(r.text!)).not.toThrow()
      expect(new RegExp(r.text!).test(lines[r.label]!), r.label).toBe(true)
    }
  })
  it('loosened checks: seven transactions and three orders are still incomplete, any letter prefix counts', () => {
    const [tx, orders] = ['transactions', 'order-history'].map((id) => loadScreens().find((s) => s.id === id)!)
    const eight = new RegExp(tx!.required.find((r) => r.label === 'eight transactions')!.text!)
    expect(eight.test(Array.from({ length: 7 }, (_, i) => `${i}.250`).join(' '))).toBe(false)
    const four = new RegExp(orders!.required.find((r) => r.label === 'four orders')!.text!)
    expect(four.test('#A-10293 #B-88492 #C-33921 #D-55120')).toBe(true)
    expect(four.test('#A-10293 #B-88492 #C-33921')).toBe(false)
    expect(four.test('#SA-8501 #SA-8492 #SA-8310 #SA-8194')).toBe(true)
    expect(four.test('#أ-10293 #أ-10292 #أ-10291 #أ-10290')).toBe(true)
  })
  it('compiles every text pattern', () => {
    for (const s of loadScreens()) for (const r of s.required) if (r.text) expect(() => new RegExp(r.text!)).not.toThrow()
  })
})
