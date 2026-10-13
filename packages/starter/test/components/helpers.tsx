import { cleanup, render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach } from 'vitest'

afterEach(cleanup)

// jsdom has no PointerEvent, so fireEvent.pointer* would drop clientX and pointerId. Real browsers have it.
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventShim extends MouseEvent {
    readonly pointerId: number
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
    }
  }
  globalThis.PointerEvent = PointerEventShim as unknown as typeof PointerEvent
}

export const SCRIPTS = [
  { name: 'EN', dir: 'ltr', lang: 'en' },
  { name: 'AR', dir: 'rtl', lang: 'ar' },
] as const

/** Render inside a block that sets the reading direction and language, as a page would. */
export function renderIn(script: { dir: 'ltr' | 'rtl'; lang: string }, ui: ReactElement) {
  return render(<div dir={script.dir} lang={script.lang}>{ui}</div>)
}
