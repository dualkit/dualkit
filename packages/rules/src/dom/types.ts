import type { Direction, NodeRef, Rect } from '../model'

export type Style = (el: Element) => CSSStyleDeclaration
export type Pred = (el: Element) => boolean
export type Ref = (el: Element, box?: Rect) => NodeRef

export const clean = (s: string): string => s.replace(/\s+/g, ' ').trim()
export const dirOf = (s: CSSStyleDeclaration): Direction => (s.direction === 'rtl' ? 'rtl' : 'ltr')
