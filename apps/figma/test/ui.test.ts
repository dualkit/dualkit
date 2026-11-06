// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { ToMain, ToUi } from '../src/messages'
import { frame, text } from './fixtures'

// Loads the real panel markup, then the UI script, and talks to it the way Figma's main thread does.

const sent: ToMain[] = []

const deliver = (message: ToUi): void => {
  window.dispatchEvent(new MessageEvent('message', { data: { pluginMessage: message } }))
}
const q = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!

beforeAll(async () => {
  const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../src/ui.html'), 'utf8')
  document.body.innerHTML = /<body>([\s\S]*)<\/body>/.exec(html)![1]!
  vi.spyOn(window.parent, 'postMessage').mockImplementation((data: unknown) => {
    sent.push((data as { pluginMessage: ToMain }).pluginMessage)
  })
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  await import('../src/ui')
})

describe('plugin window', () => {
  it('says it is ready and lists every sample kind', () => {
    expect(sent[0]).toEqual({ type: 'ready' })
    expect(q<HTMLSelectElement>('#fill-kind').options.length).toBe(11)
  })

  it('opens on the check tab and asks for a snapshot', () => {
    deliver({ type: 'mode', mode: 'check' })
    expect(q('#panel-check').hidden).toBe(false)
    expect(q('#panel-fill').hidden).toBe(true)
    expect(sent.at(-1)).toEqual({ type: 'check' })
  })

  it('renders findings grouped by rule, with the fix, and selects the layer on click', () => {
    deliver({ type: 'snapshot', note: null, root: frame([text('اتصل على 050 123 4567', { id: '5:5', name: 'Contact' }), text('<img src=x>', { family: 'Inter', name: '<b>x</b>' })]) })
    expect(q('#check-status').textContent).toBe('1 problem in 2 text layers.')
    const group = q('.group')
    expect(group.querySelector('h3')!.textContent).toBe('A number that will show in reverse')
    expect(group.querySelector('.fix')!.textContent).toMatch(/bdi/)
    q<HTMLButtonElement>('.hit').click()
    expect(sent.at(-1)).toEqual({ type: 'select', id: '5:5' })
    q<HTMLAnchorElement>('.group a').click()
    expect(sent.at(-1)).toMatchObject({ type: 'open', url: expect.stringContaining('RULES.md#bidi-unisolated-number') })
    expect(Number(q('#skipped-count').textContent)).toBeGreaterThan(10)
    expect(document.querySelector('img')).toBeNull()
  })

  it('says when nothing was found, and when nothing is selected', () => {
    deliver({ type: 'snapshot', note: 'Checked "A" only.', root: frame([text('مرحبا')]) })
    expect(q('#check-status').textContent).toBe('No problems found in 1 text layers by the rules that run in Figma. Checked "A" only.')
    deliver({ type: 'snapshot', note: null, root: null })
    expect(q('#check-status').textContent).toBe('Select a frame to check.')
    expect(q('#results').children).toHaveLength(0)
  })

  it('reports a check that throws instead of failing silently', () => {
    deliver({ type: 'snapshot', note: null, root: { kind: 'text' } as never })
    expect(q('#check-status').textContent).toMatch(/could not run/)
  })

  it('fills layers with the chosen kind, language and seed', () => {
    q<HTMLButtonElement>('#tab-fill').click()
    expect(q('#panel-fill').hidden).toBe(false)
    q<HTMLSelectElement>('#fill-kind').value = 'phone-sa'
    q<HTMLSelectElement>('#fill-language').value = 'ar-arab'
    q<HTMLInputElement>('#fill-seed').value = '3'
    q<HTMLButtonElement>('#fill-run').click()
    expect(sent.at(-1)).toEqual({ type: 'fill-request' })
    deliver({ type: 'fill-layers', layers: [{ id: '1:1', name: 'Phone' }] })
    const apply = sent.at(-1) as Extract<ToMain, { type: 'fill-apply' }>
    expect(apply.type).toBe('fill-apply')
    expect(apply.items[0]).toMatchObject({ id: '1:1', kind: 'phone-sa' })
    expect(apply.items[0]!.text).toMatch(/^[٠-٩ ]+$/)
    deliver({ type: 'filled', filled: 1, skipped: [] })
    expect(q('#fill-status').textContent).toBe('Filled 1 layers.')
    deliver({ type: 'filled', filled: 0, skipped: ['1:1'] })
    expect(q('#fill-status').textContent).toMatch(/Skipped 1/)
  })

  it('asks for a selection when there is nothing to fill, and falls back to seed 1 and auto kinds', () => {
    deliver({ type: 'fill-layers', layers: [] })
    expect(q('#fill-status').textContent).toMatch(/Select text layers/)
    q<HTMLSelectElement>('#fill-kind').value = 'auto'
    q<HTMLInputElement>('#fill-seed').value = ''
    q<HTMLSelectElement>('#fill-language').value = 'en'
    deliver({ type: 'fill-layers', layers: [{ id: '1:1', name: 'IBAN' }] })
    expect((sent.at(-1) as Extract<ToMain, { type: 'fill-apply' }>).items[0]).toMatchObject({ kind: 'iban-ae' })
  })

  it('switches back to the check tab and re-checks', () => {
    q<HTMLButtonElement>('#tab-check').click()
    expect(sent.at(-1)).toEqual({ type: 'check' })
    q<HTMLButtonElement>('#check-run').click()
    expect(sent.at(-1)).toEqual({ type: 'check' })
  })
})
