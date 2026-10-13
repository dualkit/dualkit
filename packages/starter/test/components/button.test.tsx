// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '../../components/Button'
import { SCRIPTS, renderIn } from './helpers'

describe.each(SCRIPTS)('Button, $name', (script) => {
  it('marks a forward arrow as directional, so CSS flips it with the reading direction', () => {
    renderIn(script, <Button icon="forward">Continue</Button>)
    const icon = screen.getByRole('button', { name: 'Continue' }).querySelector('svg')!
    expect(icon.classList.contains('dk-icon--directional')).toBe(true)
    expect(icon.getAttribute('aria-hidden')).toBe('true')
  })

  it('leaves close and check alone', () => {
    renderIn(script, <><Button icon="close">Close</Button><Button icon="check">Done</Button></>)
    for (const name of ['Close', 'Done']) {
      expect(screen.getByRole('button', { name }).querySelector('svg')!.classList.contains('dk-icon--directional')).toBe(false)
    }
  })

  it('does not fire when disabled', () => {
    const onClick = vi.fn()
    renderIn(script, <Button disabled onClick={onClick}>Pay</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Pay' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('Button', () => {
  it('defaults to a primary type="button" with no icon', () => {
    renderIn(SCRIPTS[0], <Button>Continue</Button>)
    const b = screen.getByRole('button', { name: 'Continue' })
    expect(b.getAttribute('type')).toBe('button')
    expect(b.className).toContain('dk-button--primary')
    expect(b.querySelector('svg')).toBeNull()
  })

  it('takes the secondary variant and passes other props through', () => {
    renderIn(SCRIPTS[0], <Button variant="secondary" type="submit" data-x="1">Learn more</Button>)
    const b = screen.getByRole('button', { name: 'Learn more' })
    expect(b.className).toContain('dk-button--secondary')
    expect(b.getAttribute('type')).toBe('submit')
    expect(b.dataset.x).toBe('1')
  })
})
