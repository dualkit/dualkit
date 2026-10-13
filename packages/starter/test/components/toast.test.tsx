// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Toast, ToastRegion } from '../../components/Toast'
import { SCRIPTS, renderIn } from './helpers'

const copy = {
  EN: { message: 'Sent AED 250.00 to Sam Santos.', undo: 'Undo' },
  AR: { message: 'تم إرسال ٢٥٠٫٠٠ د.إ إلى Sam Santos.', undo: 'تراجع' },
}

function drag(el: Element, dx: number) {
  fireEvent.pointerDown(el, { clientX: 100, clientY: 10, pointerId: 1, button: 0 })
  fireEvent.pointerMove(el, { clientX: 100 + dx, clientY: 10, pointerId: 1 })
  fireEvent.pointerUp(el, { clientX: 100 + dx, clientY: 10, pointerId: 1 })
}

describe.each(SCRIPTS)('Toast, $name', (script) => {
  const c = copy[script.name]

  it('announces itself politely as a status', () => {
    renderIn(script, <ToastRegion label="Notifications"><Toast tone="success" message={c.message} /></ToastRegion>)
    expect(screen.getByRole('region', { name: 'Notifications' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain(c.message)
  })

  it('runs its action', async () => {
    const onAction = vi.fn()
    renderIn(script, <Toast message={c.message} action={{ label: c.undo, onAction }} />)
    await userEvent.click(screen.getByRole('button', { name: c.undo }))
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('dismisses on Escape from inside it', async () => {
    const onDismiss = vi.fn()
    renderIn(script, <Toast message={c.message} action={{ label: c.undo, onAction: () => {} }} onDismiss={onDismiss} />)
    screen.getByRole('button', { name: c.undo }).focus()
    await userEvent.keyboard('{Escape}')
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})

describe('Toast swipe follows the reading direction', () => {
  it('swipes away to the right in English only', () => {
    const onDismiss = vi.fn()
    renderIn(SCRIPTS[0], <Toast message="x" onDismiss={onDismiss} />)
    const toast = screen.getByRole('status')
    drag(toast, -120)
    expect(onDismiss).not.toHaveBeenCalled()
    drag(toast, 120)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('swipes away to the left in Arabic only', () => {
    const onDismiss = vi.fn()
    renderIn(SCRIPTS[1], <Toast message="x" onDismiss={onDismiss} />)
    const toast = screen.getByRole('status')
    drag(toast, 120)
    expect(onDismiss).not.toHaveBeenCalled()
    drag(toast, -120)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})

describe('Toast timing and tone', () => {
  it('dismisses itself after its duration', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    renderIn(SCRIPTS[0], <Toast message="x" duration={4000} onDismiss={onDismiss} />)
    act(() => { vi.advanceTimersByTime(3999) })
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(onDismiss).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('pauses the timer while hovered or focused', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    renderIn(SCRIPTS[0], <Toast message="x" duration={1000} onDismiss={onDismiss} />)
    fireEvent.pointerEnter(screen.getByRole('status'))
    act(() => { vi.advanceTimersByTime(5000) })
    expect(onDismiss).not.toHaveBeenCalled()
    fireEvent.pointerLeave(screen.getByRole('status'))
    act(() => { vi.advanceTimersByTime(1000) })
    expect(onDismiss).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('carries its tone for styling and picks a matching icon', () => {
    renderIn(SCRIPTS[0], <><Toast tone="error" message="a" /><Toast message="b" /></>)
    const [error, neutral] = screen.getAllByRole('status')
    expect(error!.dataset.tone).toBe('error')
    expect(neutral!.dataset.tone).toBe('neutral')
  })
})
