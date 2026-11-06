import { describe, expect, it } from 'vitest'
import { MAX_FILL_ITEMS, MAX_FILL_TEXT, parseToMain, parseToUi } from '../src/guards'
import { frame } from './fixtures'

describe('parseToMain', () => {
  it('accepts every message the panel sends', () => {
    expect(parseToMain({ type: 'ready' })).toEqual({ type: 'ready' })
    expect(parseToMain({ type: 'check' })).toEqual({ type: 'check' })
    expect(parseToMain({ type: 'fill-request' })).toEqual({ type: 'fill-request' })
    expect(parseToMain({ type: 'select', id: '1:2' })).toEqual({ type: 'select', id: '1:2' })
    expect(parseToMain({ type: 'open', url: 'https://dualkit.dev/x' })).toEqual({ type: 'open', url: 'https://dualkit.dev/x' })
    expect(parseToMain({ type: 'fill-apply', items: [{ id: '1:1', kind: 'phone-ae', text: '050 123 4567' }] }))
      .toEqual({ type: 'fill-apply', items: [{ id: '1:1', kind: 'phone-ae', text: '050 123 4567' }] })
  })

  it('rejects unknown types, non-objects and missing fields', () => {
    for (const raw of [null, undefined, 'check', 42, {}, { type: 'delete-everything' }, { type: 'select' }, { type: 'select', id: 5 }, { type: 'open', url: null }, { type: 'fill-apply' }, { type: 'fill-apply', items: 'x' }]) {
      expect(parseToMain(raw)).toBeNull()
    }
  })

  it('rejects over-long ids and links', () => {
    expect(parseToMain({ type: 'select', id: 'x'.repeat(201) })).toBeNull()
    expect(parseToMain({ type: 'open', url: `https://dualkit.dev/${'x'.repeat(2000)}` })).toBeNull()
  })

  it('drops malformed fill items and caps the count and the text length', () => {
    const items = [{ id: '1:1', kind: 'phone-ae', text: 'ok' }, { id: 7, text: 'no' }, { id: '1:2', kind: 'nope', text: 'no' }, { id: '1:3', kind: 'iban-ae', text: 'x'.repeat(MAX_FILL_TEXT + 1) }, null]
    expect(parseToMain({ type: 'fill-apply', items })).toEqual({ type: 'fill-apply', items: [items[0]] })
    const many = Array.from({ length: MAX_FILL_ITEMS + 5 }, (_, i) => ({ id: `1:${i}`, kind: 'phone-ae', text: 't' }))
    const parsed = parseToMain({ type: 'fill-apply', items: many })
    expect(parsed?.type === 'fill-apply' && parsed.items.length).toBe(MAX_FILL_ITEMS)
  })
})

describe('parseToUi', () => {
  it('accepts every message the main thread sends', () => {
    const root = frame([])
    expect(parseToUi({ type: 'mode', mode: 'fill' })).toEqual({ type: 'mode', mode: 'fill' })
    expect(parseToUi({ type: 'snapshot', root, note: null })).toEqual({ type: 'snapshot', root, note: null })
    expect(parseToUi({ type: 'snapshot', root: null, note: 'Select a frame.' })).toEqual({ type: 'snapshot', root: null, note: 'Select a frame.' })
    expect(parseToUi({ type: 'fill-layers', layers: [{ id: '1:1', name: 'Phone' }, { id: 2 }] })).toEqual({ type: 'fill-layers', layers: [{ id: '1:1', name: 'Phone' }] })
    expect(parseToUi({ type: 'filled', filled: 2, skipped: ['1:1', 3] })).toEqual({ type: 'filled', filled: 2, skipped: ['1:1'] })
  })

  it('rejects anything else', () => {
    for (const raw of [null, 'mode', { type: 'mode', mode: 'other' }, { type: 'snapshot', root: 'x', note: null }, { type: 'snapshot', root: { kind: 'svg' }, note: null },
      { type: 'snapshot', root: null, note: 4 }, { type: 'fill-layers', layers: {} }, { type: 'filled', filled: '2', skipped: [] }, { type: 'filled', filled: 2 }, { type: 'nope' }]) {
      expect(parseToUi(raw)).toBeNull()
    }
  })
})
