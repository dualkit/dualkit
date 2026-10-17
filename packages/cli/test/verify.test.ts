// R17: the report must show quoted page text in the order its author typed it. Measured in Chromium.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium, type Browser } from 'playwright'
import { renderReport } from '../src/report'
import { finding, result } from './helpers'

let browser: Browser
beforeAll(async () => { browser = await chromium.launch() })
afterAll(() => browser.close())

/** The characters of the first finding's message as painted, line by line and left to right, spaces dropped. */
const PAINTED = `(() => {
  const li = document.querySelector('li#i1')
  const out = []
  const walker = document.createTreeWalker(li.querySelector('bdi'), NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    for (let i = 0; i < node.textContent.length; i++) {
      const range = document.createRange()
      range.setStart(node, i)
      range.setEnd(node, i + 1)
      const r = range.getClientRects()[0]
      if (r && r.width > 0 && node.textContent[i].trim()) out.push({ ch: node.textContent[i], left: r.left, top: Math.round(r.top) })
    }
  }
  return out.sort((a, b) => a.top - b.top || a.left - b.left).map((c) => c.ch).join('')
})()`

async function painted(message: string): Promise<string> {
  const p = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  try {
    await p.setContent(renderReport(result([finding({ message, node: null })])))
    return (await p.evaluate(PAINTED)) as string
  } finally {
    await p.close()
  }
}

const only = (s: string, keep: RegExp) => [...s].filter((c) => keep.test(c)).join('')

describe('R17 quoted page text in the report reads in logical order', () => {
  it('shows a phone number after Arabic as 050 123 4567', async () => {
    const shown = await painted('"رقم الهاتف 050 123 4567" is not isolated, so its groups can show in reverse order.')
    expect(only(shown, /[0-9]/)).toBe('0501234567')
  })

  // Measured: Chromium paints Arabic-Indic groups first group on the right in an rtl paragraph, an ltr
  // paragraph and inside <bdi dir="ltr"> alike (only <bdo> changes it), so the report matches the page.
  it('shows Arabic-Indic digit groups as Chromium paints them on an Arabic page', async () => {
    const shown = await painted('"رقم الهاتف \u0660\u0665\u0660 \u0661\u0662\u0663" is not isolated, so its groups can show in reverse order.')
    expect(only(shown, /[\u0660-\u0669]/)).toBe('\u0661\u0662\u0663\u0660\u0665\u0660')
  })

  it('keeps an email whole and English words in order inside an Arabic quote', async () => {
    const shown = await painted('"راسلنا على hi@example.com أو Customer Care" sits in right-to-left text without isolation.')
    expect(shown).toContain('hi@example.com')
    expect(shown).toContain('CustomerCare')
  })

  it('keeps the closing mark of an English quote at its end', async () => {
    const shown = await painted('"Hello world!" runs right to left, so its last mark moves to the start.')
    expect(shown.startsWith('"Helloworld!"runs')).toBe(true)
  })
})
