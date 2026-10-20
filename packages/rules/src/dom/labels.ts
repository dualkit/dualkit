import type { LabelNode } from '../model'
import { clean, type Pred, type Ref } from './types'

const ATTRS = ['aria-label', 'alt', 'title'] as const

/** Text the page gives to people who cannot see the element: aria-label, image alt and title. Empty values are skipped. */
export function readLabels(doc: Document, skipped: Pred, visible: Pred, ref: Ref): LabelNode[] {
  const out: LabelNode[] = []
  for (const el of Array.from(doc.body.querySelectorAll('[aria-label], [alt], [title]'))) {
    if (el.closest('svg') || skipped(el) || !visible(el)) continue
    for (const attr of ATTRS) {
      const text = clean(el.getAttribute(attr) ?? '')
      if (text) out.push({ ...ref(el), attr, text, lang: el.closest('[lang]')?.getAttribute('lang') || null })
    }
  }
  return out
}
