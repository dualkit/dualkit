import { describe, expect, it } from 'vitest'
import { glyphHead, headDirection, pathVertices, pointVertices, roleOf } from '../../src/dom/arrow'

describe('headDirection', () => {
  it('reads a chevron drawn pointing right', () => {
    expect(headDirection(pathVertices('m 9 18 6 -6 -6 -6'))).toBe('right')
  })
  it('reads its mirror as pointing left', () => {
    expect(headDirection(pathVertices('m 15 18 -6 -6 6 -6'))).toBe('left')
    expect(headDirection(pathVertices('m15 18-6-6 6-6'))).toBe('left')
  })
  it('finds no head on a path that is not an arrow', () => {
    expect(headDirection(pathVertices('M2 8h12'))).toBeNull()
    expect(headDirection(pathVertices('M3 9l9-7 9 7v11H3z'))).toBeNull()
    expect(headDirection(pathVertices('M6 15l6-6 6 6'))).toBeNull()
  })
  it('reads the head of an arrow with a shaft, the widest corner winning', () => {
    expect(headDirection(pathVertices('M19 12H5M12 19l-7-7 7-7'))).toBe('left')
  })
  it('reads polyline points', () => {
    expect(headDirection(pointVertices('9 18 15 12 9 6'))).toBe('right')
    expect(headDirection(pointVertices('15 18 9 12 15 6'))).toBe('left')
  })
  it('gives up on path data it cannot read', () => {
    expect(pathVertices('M 1 x 2')).toEqual([])
    expect(headDirection(pathVertices(''))).toBeNull()
  })
})

describe('glyphHead', () => {
  it.each([
    ['←', 'ltr', 'left'], ['→', 'ltr', 'right'], ['←', 'rtl', 'left'], ['→', 'rtl', 'right'],
    ['‹', 'ltr', 'left'], ['›', 'ltr', 'right'], ['«', 'ltr', 'left'], ['»', 'ltr', 'right'],
    // The bidi algorithm draws these the other way round in right-to-left text.
    ['‹', 'rtl', 'right'], ['›', 'rtl', 'left'], ['«', 'rtl', 'right'], ['»', 'rtl', 'left'],
  ] as const)('%s in %s points %s', (glyph, dir, head) => {
    expect(glyphHead(` ${glyph} `, dir)).toBe(head)
  })
  it('reads a glyph beside a word', () => {
    expect(glyphHead('← رجوع', 'rtl')).toBe('left')
  })
  it('reads nothing from quotes or text with no arrow', () => {
    expect(glyphHead('«اقرأ المزيد»', 'rtl')).toBeNull()
    expect(glyphHead('رجوع', 'rtl')).toBeNull()
  })
})

describe('roleOf', () => {
  it.each(['back', 'Back', 'prev', 'previous', 'رجوع', 'الرجوع', 'ارجع', 'السابق', 'عودة', 'Back to orders', 'الرجوع إلى الخطوة السابقة', 'العودة إلى صفحة الدفع', 'Previous month', 'الشهر السابق'])('reads the name %s as back', (name) => {
    expect(roleOf({ names: [name] })).toBe('back')
  })
  it.each(['next', 'forward', 'التالي', 'متابعة', 'Next page', 'الشهر التالي'])('reads the name %s as forward', (name) => {
    expect(roleOf({ names: [name] })).toBe('forward')
  })
  it.each(['الطلبات السابقة', 'Previous orders', 'Cash back offer', 'feedback', 'العودة للمدرسة عروض', ''])('reads the name %s as neither', (name) => {
    expect(roleOf({ names: [name] })).toBeNull()
  })
  it.each(['back', 'btn-back', 'prev', 'swiper-button-prev', 'slick-prev', 'nav-back', 'icon-back', 'back-btn', 'back-link', 'prevMonth', 'previous'])('reads the token %s as back', (token) => {
    expect(roleOf({ tokens: [token] })).toBe('back')
  })
  it.each(['next', 'nextMonth', 'swiper-button-next', 'slick-next', 'forward'])('reads the token %s as forward', (token) => {
    expect(roleOf({ tokens: [token] })).toBe('forward')
  })
  it.each(['previous-orders', 'previousOrders', 'cash-back-offer', 'back-office', 'feedback', 'background', 'backdrop', 'playback', 'preview', 'search', 'nextjs-root', ''])('reads the token %s as neither', (token) => {
    expect(roleOf({ tokens: [token] })).toBeNull()
  })
  it('reads nothing when the words say both', () => {
    expect(roleOf({ tokens: ['prev-next'] })).toBeNull()
    expect(roleOf({ names: ['التالي'], tokens: ['nav-btn', 'prev'] })).toBeNull()
  })
})
