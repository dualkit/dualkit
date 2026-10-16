import { afterAll, describe, expect, it } from 'vitest'
import { closeBrowser, modelAt, modelOf } from './helpers/browser'

afterAll(closeBrowser)

const doc = (body: string, css = '', attrs = 'lang="ar" dir="rtl"') =>
  `<!doctype html><html ${attrs}><head><meta charset="utf-8"><style>body{font:16px/1.7 "IBM Plex Sans Arabic",sans-serif}${css}</style></head><body>${body}</body></html>`

describe('root and texts', () => {
  it('reads lang and dir from <html>', async () => {
    expect((await modelOf(doc(''))).root).toEqual({ lang: 'ar', dir: 'rtl' })
    expect((await modelOf(doc('', '', ''))).root).toEqual({ lang: null, dir: null })
  })

  it('treats an empty lang attribute as null', async () => {
    const m = await modelOf(doc('<p>مرحبا</p>', '', 'lang="" dir="rtl"'))
    expect(m.root.lang).toBeNull()
    expect(m.texts[0]!.lang).toBeNull()
  })

  it('reads a text run with its block, direction, language and font', async () => {
    const m = await modelOf(doc('<p>مرحبا <b>بكم</b></p>'))
    const b = m.texts.find((t) => t.text === 'بكم')!
    expect(b).toMatchObject({ blockText: 'مرحبا بكم', blockDir: 'rtl', dir: 'rtl', lang: 'ar', isolated: false, isLastInBlock: true, lines: 1 })
    expect(b.font).toMatchObject({ size: 16, letterSpacing: 0, style: 'normal', weight: 700 })
    expect(b.font.lineHeight).toBeCloseTo(27.2)
    expect(b.font.families[0]).toBe('IBM Plex Sans Arabic')
  })

  it.each([
    ['<bdi>050 123 4567</bdi>'],
    ['<span dir="ltr">050 123 4567</span>'],
    ['<span style="unicode-bidi:isolate">050 123 4567</span>'],
  ])('treats %s as isolated', async (inner) => {
    const m = await modelOf(doc(`<p>الهاتف ${inner}</p>`))
    expect(m.texts.find((t) => t.text === '050 123 4567')?.isolated).toBe(true)
  })

  it('counts wrapped lines', async () => {
    const m = await modelOf(doc('<p style="width:80px">نص عربي طويل يمتد على عدة أسطر</p>'))
    expect(m.texts[0]!.lines).toBeGreaterThan(1)
  })

  it('skips hidden, script and style text', async () => {
    const m = await modelOf(doc('<p hidden>مخفي</p><p style="display:none">مخفي</p><script>var a = 1</script><p>ظاهر</p>'))
    expect(m.texts.map((t) => t.text)).toEqual(['ظاهر'])
  })
})

describe('layouts', () => {
  it('records physical properties that render asymmetric', async () => {
    const m = await modelOf(doc('<div id="one" class="a">نص</div><div id="two" class="b">نص</div>', '.a{margin-left:16px}.b{margin:0 8px}'))
    expect(m.layouts.find((l) => l.id === 'div#one')?.physical).toEqual([{ property: 'margin-left', value: '16px' }])
    expect(m.layouts.some((l) => l.id === 'div#two')).toBe(false)
  })

  it('reads inline styles and logical properties correctly', async () => {
    const m = await modelOf(doc('<div style="padding-right:4px">نص</div><div style="margin-inline-start:16px">نص</div>'))
    expect(m.layouts).toHaveLength(1)
    expect(m.layouts[0]!.physical[0]!.property).toBe('padding-right')
  })

  it('counts cross-origin stylesheets it cannot read', async () => {
    const m = await modelAt('http://a.test/', {
      'http://a.test/': { body: doc('<p>نص</p>').replace('</head>', '<link rel="stylesheet" href="http://b.test/x.css"></head>'), type: 'text/html' },
      'http://b.test/x.css': { body: 'p{margin-left:4px}', type: 'text/css' },
    })
    expect(m.unreadableStylesheets).toBe(1)
  })
})

describe('icons and fields', () => {
  it('names icons from data attributes, classes, <use> and alt text, and sees mirroring', async () => {
    const svg = (attrs: string) => `<svg ${attrs} width="16" height="16" viewBox="0 0 16 16"><path d="M2 8h12"/></svg>`
    const m = await modelOf(doc([
      svg('data-icon="arrow-right"'),
      svg('class="lucide lucide-chevron-left" style="transform:scaleX(-1)"'),
      '<svg width="16" height="16"><use href="#back"></use></svg>',
      '<img alt="play" width="16" height="16" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">',
    ].join('')))
    expect(m.icons.map((i) => [i.name, i.mirrored])).toEqual([['arrow-right', false], ['chevron-left', true], ['back', false], ['play', false]])
  })

  it('normalises PascalCase and camelCase icon names to kebab-case', async () => {
    const svg = (attrs: string) => `<svg ${attrs} width="16" height="16" viewBox="0 0 16 16"><path d="M2 8h12"/></svg>`
    const m = await modelOf(doc([
      svg('data-icon="ChevronLeft"'),
      svg('data-icon="BackIcon"'),
      svg('data-icon="arrowRight"'),
      svg('class="lucide-chevron-left"'),
    ].join('')))
    expect(m.icons.map((i) => i.name)).toEqual(['chevron-left', 'back-icon', 'arrow-right', 'chevron-left'])
  })

  it('classifies fields and reads their direction', async () => {
    const m = await modelOf(doc('<input type="email"><input type="tel" dir="ltr"><input name="iban"><input>'))
    expect(m.fields.map((f) => [f.kind, f.dir, f.dirAttr])).toEqual([['email', 'rtl', null], ['tel', 'ltr', 'ltr'], ['code', 'rtl', null], ['text', 'rtl', null]])
  })
})

describe('options', () => {
  it('skips excluded regions and survives an invalid selector', async () => {
    const m = await modelOf(doc('<div class="skip"><p>تخطى</p></div><p>اقرأ</p>'), { exclude: ['.skip', '[[['] })
    expect(m.texts.map((t) => t.text)).toEqual(['اقرأ'])
  })
})
