// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '../../components/Button'
import { Sheet, SheetRow } from '../../components/Sheet'
import { SCRIPTS, renderIn } from './helpers'

const copy = {
  EN: { title: 'Payment details', cancel: 'Cancel', pay: 'Pay now', close: 'Close' },
  AR: { title: 'تفاصيل الدفع', cancel: 'إلغاء', pay: 'ادفع الآن', close: 'إغلاق' },
}

function Harness({ c }: { c: (typeof copy)['EN'] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open</button>
      <Sheet open={open} onClose={() => setOpen(false)} title={c.title} closeLabel={c.close}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{c.cancel}</Button><Button>{c.pay}</Button></>}>
        <SheetRow label="IBAN" value="AE07 0331 2345 6789 0123 456" mono />
      </Sheet>
    </>
  )
}

/** Drag the panel by dx pixels along the inline axis. */
function drag(el: Element, dx: number) {
  fireEvent.pointerDown(el, { clientX: 100, clientY: 100, pointerId: 1, button: 0 })
  fireEvent.pointerMove(el, { clientX: 100 + dx, clientY: 100, pointerId: 1 })
  fireEvent.pointerUp(el, { clientX: 100 + dx, clientY: 100, pointerId: 1 })
}

describe.each(SCRIPTS)('Sheet, $name', (script) => {
  const c = copy[script.name]

  it('renders nothing while closed', () => {
    renderIn(script, <Harness c={c} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens as a labelled modal dialog and moves focus inside', async () => {
    renderIn(script, <Harness c={c} />)
    await userEvent.click(screen.getByText('Open'))
    const dialog = screen.getByRole('dialog', { name: c.title })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('traps Tab inside, both ways', async () => {
    renderIn(script, <Harness c={c} />)
    await userEvent.click(screen.getByText('Open'))
    const first = screen.getByRole('button', { name: c.close })
    const last = screen.getByRole('button', { name: c.pay })
    last.focus()
    await userEvent.tab()
    expect(document.activeElement).toBe(first)
    await userEvent.tab({ shift: true })
    expect(document.activeElement).toBe(last)
  })

  it('closes on Escape and gives focus back to what opened it', async () => {
    renderIn(script, <Harness c={c} />)
    const opener = screen.getByText('Open')
    await userEvent.click(opener)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('closes from the close button and from the scrim', async () => {
    renderIn(script, <Harness c={c} />)
    await userEvent.click(screen.getByText('Open'))
    await userEvent.click(screen.getByRole('button', { name: c.close }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await userEvent.click(screen.getByText('Open'))
    fireEvent.pointerDown(document.querySelector('.dk-sheet__scrim')!)
    fireEvent.click(document.querySelector('.dk-sheet__scrim')!)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('stops the page behind from scrolling while open, and puts it back', async () => {
    document.body.style.overflow = 'auto'
    renderIn(script, <Harness c={c} />)
    await userEvent.click(screen.getByText('Open'))
    expect(document.body.style.overflow).toBe('hidden')
    await userEvent.keyboard('{Escape}')
    expect(document.body.style.overflow).toBe('auto')
  })

  it('shows identifiers left to right in mono', async () => {
    renderIn(script, <Harness c={c} />)
    await userEvent.click(screen.getByText('Open'))
    const value = screen.getByText('AE07 0331 2345 6789 0123 456')
    expect(value.getAttribute('dir')).toBe('ltr')
    expect(value.className).toContain('dk-mono')
  })
})

describe('Sheet swipe follows the side it opened from', () => {
  it('a drag towards the right closes it in English, a drag left does not', () => {
    const onClose = vi.fn()
    renderIn(SCRIPTS[0], <Sheet open onClose={onClose} title="Payment details">x</Sheet>)
    const panel = document.querySelector('.dk-sheet__panel')!
    drag(panel, -120)
    expect(onClose).not.toHaveBeenCalled()
    drag(panel, 120)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('a drag towards the left closes it in Arabic, a drag right does not', () => {
    const onClose = vi.fn()
    renderIn(SCRIPTS[1], <Sheet open onClose={onClose} title="تفاصيل الدفع">x</Sheet>)
    const panel = document.querySelector('.dk-sheet__panel')!
    drag(panel, 120)
    expect(onClose).not.toHaveBeenCalled()
    drag(panel, -120)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('a short drag snaps back', () => {
    const onClose = vi.fn()
    renderIn(SCRIPTS[0], <Sheet open onClose={onClose} title="Payment details">x</Sheet>)
    drag(document.querySelector('.dk-sheet__panel')!, 20)
    expect(onClose).not.toHaveBeenCalled()
  })
})
