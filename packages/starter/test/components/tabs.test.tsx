// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Tabs } from '../../components/Tabs'
import { SCRIPTS, renderIn } from './helpers'

const labels = { EN: ['Overview', 'Payments', 'Settings'], AR: ['نظرة عامة', 'المدفوعات', 'الإعدادات'] }
const items = (names: readonly string[]) => names.map((label, k) => ({ id: `t${k}`, label, panel: <p>Panel {k}</p> }))
const tabs = () => screen.getAllByRole('tab')
const selected = () => tabs().findIndex((t) => t.getAttribute('aria-selected') === 'true')

describe.each(SCRIPTS)('Tabs, $name', (script) => {
  const names = labels[script.name]

  it('follows the WAI-ARIA tabs pattern with one tab in the tab order', () => {
    renderIn(script, <Tabs label="Account" items={items(names)} />)
    expect(screen.getByRole('tablist', { name: 'Account' })).toBeTruthy()
    expect(tabs().map((t) => t.tabIndex)).toEqual([0, -1, -1])
    const panel = screen.getByRole('tabpanel')
    expect(panel.getAttribute('aria-labelledby')).toBe(tabs()[0]!.id)
    expect(tabs()[0]!.getAttribute('aria-controls')).toBe(panel.id)
    expect(panel.textContent).toBe('Panel 0')
  })

  it('keeps every panel in the document, with only the active one shown', () => {
    renderIn(script, <Tabs label="Account" items={items(names)} />)
    const panels = screen.getAllByRole('tabpanel', { hidden: true })
    expect(panels).toHaveLength(3)
    expect(panels.map((p) => p.hidden)).toEqual([false, true, true])
    tabs().forEach((t, k) => expect(t.getAttribute('aria-controls')).toBe(panels[k]!.id))
  })

  it('selects on click and reports it', async () => {
    const onValueChange = vi.fn()
    renderIn(script, <Tabs label="Account" items={items(names)} onValueChange={onValueChange} />)
    await userEvent.click(tabs()[1]!)
    expect(selected()).toBe(1)
    expect(onValueChange).toHaveBeenCalledWith('t1')
    expect(screen.getByRole('tabpanel').textContent).toBe('Panel 1')
  })

  it('jumps to the first and last tab with Home and End', () => {
    renderIn(script, <Tabs label="Account" items={items(names)} />)
    fireEvent.keyDown(tabs()[0]!, { key: 'End' })
    expect(selected()).toBe(2)
    expect(document.activeElement).toBe(tabs()[2])
    fireEvent.keyDown(tabs()[2]!, { key: 'Home' })
    expect(selected()).toBe(0)
  })
})

describe('Tabs arrow keys follow the reading direction', () => {
  it('ArrowRight moves on in English, and wraps', () => {
    renderIn(SCRIPTS[0], <Tabs label="Account" items={items(labels.EN)} />)
    fireEvent.keyDown(tabs()[0]!, { key: 'ArrowRight' })
    expect(selected()).toBe(1)
    expect(document.activeElement).toBe(tabs()[1])
    fireEvent.keyDown(tabs()[1]!, { key: 'ArrowLeft' })
    fireEvent.keyDown(tabs()[0]!, { key: 'ArrowLeft' })
    expect(selected()).toBe(2)
  })

  it('ArrowLeft moves on in Arabic, and ArrowRight goes back', () => {
    renderIn(SCRIPTS[1], <Tabs label="الحساب" items={items(labels.AR)} />)
    fireEvent.keyDown(tabs()[0]!, { key: 'ArrowLeft' })
    expect(selected()).toBe(1)
    fireEvent.keyDown(tabs()[1]!, { key: 'ArrowRight' })
    expect(selected()).toBe(0)
    fireEvent.keyDown(tabs()[0]!, { key: 'ArrowRight' })
    expect(selected()).toBe(2)
  })

  it('stays put when controlled and the owner does not change the value', () => {
    renderIn(SCRIPTS[0], <Tabs label="Account" items={items(labels.EN)} value="t0" />)
    fireEvent.keyDown(tabs()[0]!, { key: 'ArrowRight' })
    expect(selected()).toBe(0)
  })
})
