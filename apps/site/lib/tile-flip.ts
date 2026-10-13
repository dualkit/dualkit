// Starter tiles show one language at rest. A mouse hover or keyboard focus peeks at the other;
// a click, tap or Enter pins whatever is showing, so letting go never snaps it back.

export type Lang = 'en' | 'ar'
export type Pointer = 'mouse' | 'pen' | 'touch' | 'keyboard'
export type FlipState = { peek: boolean; pinned: boolean }
export type FlipEvent =
  | { type: 'enter' | 'leave'; pointer: Pointer }
  | { type: 'focus' | 'blur' }
  | { type: 'activate'; pointer: Pointer }

const other = (l: Lang): Lang => (l === 'en' ? 'ar' : 'en')

export function shown(base: Lang, s: FlipState): Lang {
  return s.peek !== s.pinned ? other(base) : base
}

export function flip(s: FlipState, e: FlipEvent): FlipState {
  switch (e.type) {
    case 'enter': return e.pointer === 'touch' ? s : { ...s, peek: true }
    case 'leave': return e.pointer === 'touch' ? s : { ...s, peek: false }
    case 'focus': return { ...s, peek: true }
    case 'blur': return { ...s, peek: false }
    case 'activate': {
      // Pin what is showing now, and drop the peek so nothing changes on screen.
      if (s.peek) return { peek: false, pinned: !s.pinned }
      return { ...s, pinned: !s.pinned }
    }
  }
}
