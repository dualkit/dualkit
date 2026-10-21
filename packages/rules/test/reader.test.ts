import { afterAll, describe, expect, it } from 'vitest'
import { closeBrowser, modelAt, modelOf, timeRead } from './helpers/browser'
import { page } from './fixtures'

afterAll(closeBrowser)

const doc = (body: string, css = '', attrs = 'lang="ar" dir="rtl"') =>
  `<!doctype html><html ${attrs}><head><meta charset="utf-8"><style>body{font:16px/1.7 "IBM Plex Sans Arabic",sans-serif}${css}</style></head><body>${body}</body></html>`

describe('root and texts', () => {
  it('reads lang and dir from <html>', async () => {
    expect((await modelOf(doc(''))).root).toEqual({ lang: 'ar', dir: 'rtl', computedDir: 'rtl' })
    expect((await modelOf(doc('', '', ''))).root).toEqual({ lang: null, dir: null, computedDir: 'ltr' })
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

  it('reads stylesheet rules and logical properties correctly, and leaves inline styles alone', async () => {
    const m = await modelOf(doc('<div class="p">نص</div><div class="l">نص</div><div style="padding-right:4px">نص</div>').replace('</head>', '<style>.p{padding-right:4px}.l{margin-inline-start:16px}</style></head>'))
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

  it('names an icon from its title, an SVG <title>, or the aria-label of the button or link around it', async () => {
    const m = await modelOf(page([
      '<i title="Back" style="display:inline-block;width:16px;height:16px"></i>',
      '<svg width="16" height="16"><title>Arrow Right</title><path d="M2 8h12"/></svg>',
      '<button aria-label="Next"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 8h12"/></svg></button>',
      '<a href="#" aria-label="Previous"><svg width="16" height="16"><path d="M2 8h12"/></svg></a>',
      '<svg width="16" height="16"><path d="M2 8h12"/></svg>',
    ].join('')))
    expect(m.icons.map((i) => i.name)).toEqual(['back', 'arrow right', 'next', 'previous', null])
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

describe('real page fixes', () => {
  const svg = (attrs: string, inner = '<path d="M2 8h12"/>') => `<svg ${attrs} width="16" height="16" viewBox="0 0 16 16">${inner}</svg>`

  it('reports a wrapped icon once, on the innermost element', async () => {
    const m = await modelOf(doc(`<span class="icon">${svg('style="transform:scaleX(-1)"', '<use href="#arrow-left"/>')}</span>`))
    expect(m.icons).toHaveLength(1)
    expect(m.icons[0]).toMatchObject({ name: 'arrow-left', mirrored: true })
  })

  it('prefers the icon class over aria-label', async () => {
    const m = await modelOf(doc(svg('class="lucide lucide-chevron-left" aria-label="رجوع"')))
    expect(m.icons[0]!.name).toBe('chevron-left')
  })

  it('falls back to aria-label when nothing else names the icon', async () => {
    const m = await modelOf(doc(svg('aria-label="Close"')))
    expect(m.icons[0]!.name).toBe('close')
  })

  it('reads 5,000 inline spans in one block quickly', async () => {
    const spans = Array.from({ length: 5000 }, (_, i) => `<span>كلمة${i} </span>`).join('')
    const { ms, texts } = await timeRead(doc(`<pre style="white-space:pre-wrap">${spans}</pre>`))
    expect(texts).toBe(5000)
    expect(ms).toBeLessThan(1500)
    const t = Date.now()
    const m = await modelOf(doc(`<pre style="white-space:pre-wrap">${spans}</pre>`))
    expect(m.texts).toHaveLength(5000)
    expect(Date.now() - t).toBeLessThan(5000)
  })

  it('reads 5,000 style rules quickly and still finds the physical one', async () => {
    const css = Array.from({ length: 5000 }, (_, i) => `div:not(.r${i}){color:red}`).join('') + '.x{margin-left:8px}'
    const filler = '<div>نص</div>'.repeat(2000)
    const t = Date.now()
    const m = await modelOf(doc(`${filler}<div class="x">نص</div>`, css))
    expect(m.layouts.find((l) => l.id.includes('div.x'))?.physical).toEqual([{ property: 'margin-left', value: '8px' }])
    // About 800 ms alone; CI runners take about 4.1 s with the suite in parallel.
    expect(Date.now() - t).toBeLessThan(6000)
  })

  it('does not report a physical property that a later rule zeroed out', async () => {
    const m = await modelOf(doc('<div class="w">نص</div><div class="a">نص</div>', '.w{margin-left:16px}.w{margin-inline-start:16px;margin-left:0}.a{margin-left:16px}'))
    expect(m.layouts).toHaveLength(1)
    expect(m.layouts[0]!.id).toContain('div.a')
  })

  it('walks @import stylesheets', async () => {
    const m = await modelAt('http://a.test/', {
      'http://a.test/': { body: doc('<div class="i">نص</div>', '@import url("http://a.test/i.css");').replace('<style>', '<style>@import url("http://a.test/i.css");'), type: 'text/html' },
      'http://a.test/i.css': { body: '.i{padding-left:20px}', type: 'text/css' },
    })
    expect(m.layouts.find((l) => l.id.includes('div.'))?.physical).toEqual([{ property: 'padding-left', value: '20px' }])
  })

  it('treats the sr-only pattern as hidden text', async () => {
    const m = await modelOf(doc('<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap">للقراءة فقط</span><p>ظاهر</p>'))
    expect(m.texts.map((t) => t.text)).toEqual(['ظاهر'])
  })

  it('does not isolate on an empty or invalid dir attribute', async () => {
    const m = await modelOf(doc('<p>الهاتف <span dir="">050 123 4567</span> <span dir="foo">050 123 4568</span></p>'))
    expect(m.texts.find((t) => t.text === '050 123 4567')?.isolated).toBe(false)
    expect(m.texts.find((t) => t.text === '050 123 4568')?.isolated).toBe(false)
  })

  it('caps block text on every run but still decides isLastInBlock from the full text', async () => {
    const spans = Array.from({ length: 2000 }, (_, i) => `<span>كلمة${i}</span> `).join('')
    const m = await modelOf(doc(`<p>${spans}</p>`))
    expect(m.texts).toHaveLength(2000)
    for (const t of m.texts) {
      expect(t.blockText.length).toBeLessThanOrEqual(601)
      expect(t.blockText.startsWith('كلمة0 كلمة1')).toBe(true)
      expect(t.blockText.endsWith('كلمة1999')).toBe(true)
    }
    expect(m.texts.filter((t) => t.isLastInBlock).map((t) => t.text)).toEqual(['كلمة1999'])
  })
})

describe('reader foundation: fonts, labels, placeholders, clips, mirrored text', () => {
  it('lists the fixture faces as loaded, with their weight range', async () => {
    const m = await modelOf(page('<p>مرحبا <b>بكم</b></p>'))
    const plex = m.fonts.filter((f) => f.family === 'IBM Plex Sans Arabic')
    expect(plex.map((f) => [f.weight, f.status])).toEqual(expect.arrayContaining([[[400, 400], 'loaded'], [[700, 700], 'loaded']]))
    expect(plex[0]).toMatchObject({ style: 'normal', sizeAdjust: 1 })
  })

  it('reads size-adjust as a ratio', async () => {
    const css = '@font-face{font-family:"Adj";src:local("Arial");size-adjust:90%}'
    const m = await modelOf(page('<p>x</p>', { css }))
    expect(m.fonts.find((f) => f.family === 'Adj')?.sizeAdjust).toBeCloseTo(0.9)
  })

  it('reads aria-label, alt and title, and skips empty values', async () => {
    const m = await modelOf(page('<button aria-label="إغلاق" title="">x</button><img alt="شعار" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="4" height="4"><a title="رابط" href="#">y</a><i aria-label="  "></i>'))
    expect(m.labels.map((l) => [l.attr, l.text, l.lang])).toEqual([['aria-label', 'إغلاق', 'ar'], ['alt', 'شعار', 'ar'], ['title', 'رابط', 'ar']])
  })

  it('reads a field placeholder', async () => {
    const m = await modelOf(page('<input placeholder="الاسم"><input>'))
    expect(m.fields.map((f) => f.placeholder)).toEqual(['الاسم', ''])
  })

  it('reads whether the placeholder is showing: a typed value hides it', async () => {
    const m = await modelOf(page('<input placeholder="الاسم"><input placeholder="الاسم" value="سارة"><input>'))
    expect(m.fields.map((f) => f.placeholderShown)).toEqual([true, false, false])
  })

  it('reads a run that is a whole line closed by a <br>, also out of an inline tag, and not a run sharing its line', async () => {
    const m = await modelOf(page('<p>Hello world!<br>مرحبا <b>بكم</b>.<br><i>Pro.</i><br>سطر<i>1</i> <b>ثان</b><br></p><p><b>Two!</b></p>'))
    expect(m.texts.map((t) => [t.text, t.endsLine])).toEqual([
      ['Hello world!', true], ['مرحبا', false], ['بكم', false], ['.', false], ['Pro.', true], ['سطر', false], ['1', false], ['ثان', false], ['Two!', false],
    ])
  })

  it('reads a clipped box, its ellipsis, and nothing for visible overflow', async () => {
    const text = 'نص عربي طويل جدا يتجاوز عرض الصندوق بكثير ولا يتسع فيه أبدا'
    const hidden = await modelOf(page(`<div class="b">${text}</div>`, { css: '.b{width:60px;overflow:hidden;white-space:nowrap}' }))
    expect(hidden.clips).toHaveLength(1)
    expect(hidden.clips[0]).toMatchObject({ axis: 'x', ellipsis: false, hasArabic: true })
    expect(hidden.clips[0]!.hidden).toBeGreaterThan(100)
    const ell = await modelOf(page(`<div class="b">${text}</div>`, { css: '.b{width:60px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}' }))
    expect(ell.clips[0]!.ellipsis).toBe(true)
    const vis = await modelOf(page(`<div class="b">${text}</div>`, { css: '.b{width:60px;overflow:visible;white-space:nowrap}' }))
    expect(vis.clips).toEqual([])
  })

  it('skips a visually hidden clip box', async () => {
    const m = await modelOf(page('<span class="sr">نص طويل جدا جدا</span>', { css: '.sr{position:absolute;width:1px;height:1px;overflow:hidden;white-space:nowrap}' }))
    expect(m.clips).toEqual([])
  })

  it('reads a y-axis clip: a fixed-height box that cuts its text', async () => {
    const m = await modelOf(page('<div class="b">نص عربي</div>', { css: '.b{height:10px;overflow:hidden;line-height:1.7}' }))
    expect(m.clips).toHaveLength(1)
    expect(m.clips[0]).toMatchObject({ axis: 'y', ellipsis: false, hasArabic: true })
    expect(m.clips[0]!.hidden).toBeGreaterThan(2)
  })

  it('reads no clip when the box scrolls for an oversized image but its caption fits', async () => {
    const img = '<img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" style="display:block;width:600px;height:20px">'
    const m = await modelOf(page(`<div class="card">${img}<p>وصف قصير</p></div>`, { css: '.card{width:200px;overflow:hidden}' }))
    expect(m.clips).toEqual([])
  })

  it('reads no clip for text that fits in an overflow:hidden box', async () => {
    const m = await modelOf(page('<div class="b">نص قصير</div>', { css: '.b{width:300px;overflow:hidden}' }))
    expect(m.clips).toEqual([])
  })

  it('reads a clip from the text of an inline descendant', async () => {
    const m = await modelOf(page('<div class="b"><b>نص عربي طويل جدا يتجاوز العرض بكثير ولا يتسع</b></div>', { css: '.b{width:60px;overflow:hidden;white-space:nowrap}' }))
    expect(m.clips).toHaveLength(1)
  })

  it('does not read a clip for text inside an .sr-only ancestor', async () => {
    const css = '.sr-only{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}.in{overflow:hidden;width:20px;white-space:nowrap}'
    const m = await modelOf(page('<div class="sr-only"><div class="in">نص عربي طويل جدا جدا جدا</div></div>', { css }))
    expect(m.clips).toEqual([])
  })

  it.each(['inset(100%)', 'inset(0 0 100% 0)', 'inset(50%)'])('treats clip-path %s as visually hidden', async (clipPath) => {
    const m = await modelOf(page('<span class="h">للقراءة فقط</span><p>ظاهر</p>', { css: `.h{clip-path:${clipPath};position:absolute;white-space:nowrap}` }))
    expect(m.texts.map((t) => t.text)).toEqual(['ظاهر'])
  })

  it('names the nearest flipping element as mirroredBy, and null for a double flip', async () => {
    const m = await modelOf(page('<div id="a" style="transform:scaleX(-1)"><p id="b">مرحبا</p><p id="c">بكم</p></div><div style="transform:scaleX(-1)"><div style="transform:scaleX(-1)"><p>مزدوج</p></div></div>'))
    expect(m.texts.map((t) => [t.text, t.mirroredBy === null ? null : t.mirroredBy.length > 0])).toEqual([['مرحبا', true], ['بكم', true], ['مزدوج', null]])
    expect(m.texts[0]!.mirroredBy).toBe(m.texts[1]!.mirroredBy)
    expect(m.texts[0]!.mirroredBy).not.toBe(m.texts[0]!.id)
  })

  it('reads mirrored as the product of scale signs', async () => {
    const m = await modelOf(page('<p style="transform:scaleX(-1)">مرحبا</p><div style="transform:scaleX(-1)"><div style="transform:scaleX(-1)"><p>بكم</p></div></div><p>عادي</p>'))
    expect(m.texts.map((t) => [t.text, t.mirrored])).toEqual([['مرحبا', true], ['بكم', false], ['عادي', false]])
  })
})
