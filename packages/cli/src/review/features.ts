import type { ScreenModel } from '@dualkit/rules'

export type Feature = 'dates' | 'money' | 'tables' | 'forms' | 'chat' | 'icons' | 'numbers-in-text'

const DIGIT = '[0-9\\u0660-\\u0669\\u06F0-\\u06F9]'
const DATE = new RegExp(
  `${DIGIT}{1,4}\\s?[/.-]\\s?${DIGIT}{1,2}\\s?[/.-]\\s?${DIGIT}{2,4}|${DIGIT}{1,2}\\s(?:يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)|(?:محرم|صفر|رجب|شعبان|رمضان|شوال)\\s${DIGIT}`,
)
const MONEY = new RegExp(
  `(?:${DIGIT}[\\s\\u00a0]?(?:ر\\.?\\s?س|د\\.?\\s?إ|ريال|درهم|دينار|SAR|AED|KWD|QAR|BHD|OMR|SR|\\u20c1|\\u20c3|\\u20c4|﷼)|(?:SAR|AED|KWD|QAR|BHD|OMR|\\$|€|£|﷼)[\\s\\u00a0]?${DIGIT})`,
)
const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/
const CHAT_HINT = /chat|bubble|message-list|conversation/i

/** Which kinds of content the screen has, so the reviewer only asks about rules that can apply. */
export function detectFeatures(model: ScreenModel, tags: Record<string, number>): Feature[] {
  const arabic = model.texts.filter((t) => ARABIC.test(t.text))
  const has = (k: string) => (tags[k] ?? 0) > 0
  const found: [Feature, boolean][] = [
    ['dates', model.texts.some((t) => DATE.test(t.text))],
    ['money', model.texts.some((t) => MONEY.test(t.text))],
    ['tables', has('table')],
    ['forms', has('form') || has('input') || model.fields.length > 0],
    ['chat', has('chat') || model.layouts.some((l) => CHAT_HINT.test(l.snippet))],
    ['icons', model.icons.length > 0],
    ['numbers-in-text', arabic.some((t) => new RegExp(DIGIT).test(t.text))],
  ]
  return found.filter(([, on]) => on).map(([f]) => f)
}
