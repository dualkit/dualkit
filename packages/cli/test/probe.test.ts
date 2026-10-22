import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium, type Browser, type Page } from 'playwright'
import { markDroppedDigits, probeArabicDigits, PROBE_MAX_FIELDS } from '../src/probe'

/** The eval injector's planted bug, verbatim: typed Arabic-Indic digits are deleted. */
const STRIP = `pattern="[0-9]*" oninput="this.value=this.value.replace(/[^0-9]/g,'')"`
const CONVERT = `oninput="this.value=this.value.replace(/[٠-٩]/g,(d)=>String(d.charCodeAt(0)-1632))"`

type Kind = 'email' | 'tel' | 'url' | 'number' | 'code' | 'text'
const field = (id: string, kind: Kind = 'code') => ({ id, kind })

let browser: Browser
beforeAll(async () => { browser = await chromium.launch() })
afterAll(async () => { await browser.close() })

async function onPage<T>(body: string, run: (p: Page) => Promise<T>): Promise<T> {
  const page = await browser.newPage()
  try {
    await page.setContent(`<!doctype html><html lang="ar" dir="rtl"><body>${body}</body></html>`)
    return await run(page)
  } finally {
    await page.close()
  }
}

describe('probeArabicDigits', () => {
  it('reports a field whose oninput deletes Arabic digits', async () => {
    const found = await onPage(`<input id="otp" autocomplete="one-time-code" inputmode="numeric" ${STRIP}>`, (p) => probeArabicDigits(p, [field('#otp')]))
    expect(found).toEqual(new Map([['#otp', true]]))
  })
  it('reports a one-character code box that deletes Arabic digits', async () => {
    const found = await onPage(`<input id="d1" maxlength="1" ${STRIP}>`, (p) => probeArabicDigits(p, [field('#d1')]))
    expect(found.get('#d1')).toBe(true)
  })
  it('passes a plain numeric field', async () => {
    const found = await onPage('<input id="otp" autocomplete="one-time-code" inputmode="numeric">', (p) => probeArabicDigits(p, [field('#otp')]))
    expect(found).toEqual(new Map([['#otp', false]]))
  })
  it('passes a one-character code box that keeps the first digit', async () => {
    const found = await onPage('<input id="d1" maxlength="1" inputmode="numeric">', (p) => probeArabicDigits(p, [field('#d1')]))
    expect(found.get('#d1')).toBe(false)
  })
  it('passes a field that converts Arabic digits to Western ones', async () => {
    const found = await onPage(`<input id="tel" type="tel" ${CONVERT}>`, (p) => probeArabicDigits(p, [field('#tel', 'tel')]))
    expect(found.get('#tel')).toBe(false)
  })
  it('leaves out a disabled field, a read-only field and a field it cannot find', async () => {
    const found = await onPage(`<input id="a" disabled ${STRIP}><input id="b" readonly ${STRIP}>`,
      (p) => probeArabicDigits(p, [field('#a'), field('#b'), field('#gone')]))
    expect(found.size).toBe(0)
  })
  it('only types into code, tel and number fields', async () => {
    const body = ['email', 'url', 'text'].map((t) => `<input id="${t}" type="${t === 'text' ? 'text' : t}" ${STRIP}>`).join('')
    const found = await onPage(body, (p) => probeArabicDigits(p, [field('#email', 'email'), field('#url', 'url'), field('#text', 'text')]))
    expect(found.size).toBe(0)
  })
  it(`probes at most ${PROBE_MAX_FIELDS} fields`, async () => {
    const ids = Array.from({ length: PROBE_MAX_FIELDS + 2 }, (_, i) => `f${i}`)
    const found = await onPage(ids.map((id) => `<input id="${id}" maxlength="1" ${STRIP}>`).join(''), (p) => probeArabicDigits(p, ids.map((id) => field(`#${id}`))))
    expect([...found.keys()]).toEqual(ids.slice(0, PROBE_MAX_FIELDS).map((id) => `#${id}`))
  })
  it('restores each field\'s value and never submits its form', async () => {
    const after = await onPage(
      `<form onsubmit="document.body.dataset.sent='yes';return false"><input id="a" value="٣٤" ${STRIP}><input id="b" type="tel" value="0501234567"></form>`,
      async (p) => {
        await probeArabicDigits(p, [field('#a'), field('#b', 'tel')])
        return [await p.locator('#a').inputValue(), await p.locator('#b').inputValue(), await p.locator('body').getAttribute('data-sent')]
      })
    expect(after).toEqual(['٣٤', '0501234567', null])
  })
  it('stops probing when typing navigates the page', async () => {
    const found = await onPage(
      `<input id="a" oninput="location.hash='gone'"><input id="b" ${STRIP}>`,
      (p) => probeArabicDigits(p, [field('#a'), field('#b')]))
    expect(found.has('#b')).toBe(false)
  })
})

describe('markDroppedDigits', () => {
  it('sets each probed field and leaves the rest null, without changing the input', () => {
    const fields = [{ id: '#a', dropsArabicDigits: null }, { id: '#b', dropsArabicDigits: null }, { id: '#c', dropsArabicDigits: null }]
    const marked = markDroppedDigits(fields, new Map([['#a', true], ['#b', false]]))
    expect(marked.map((f) => f.dropsArabicDigits)).toEqual([true, false, null])
    expect(fields.map((f) => f.dropsArabicDigits)).toEqual([null, null, null])
  })
})
