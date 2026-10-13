// The reading direction of an element, read when it is needed (on a key press or a drag), never during render.
export type Direction = 'ltr' | 'rtl'

export function directionOf(el: Element | null): Direction {
  const attr = el?.closest('[dir]')?.getAttribute('dir')
  if (attr === 'rtl' || attr === 'ltr') return attr
  if (el && typeof getComputedStyle === 'function') return getComputedStyle(el).direction === 'rtl' ? 'rtl' : 'ltr'
  return 'ltr'
}

/** +1 when the inline end is to the right, -1 when it is to the left. */
export const inlineSign = (el: Element | null): 1 | -1 => (directionOf(el) === 'rtl' ? -1 : 1)

export const cx = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(' ')
