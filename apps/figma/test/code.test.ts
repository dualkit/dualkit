import { runInNewContext } from 'node:vm'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { beforeAll, describe, expect, it } from 'vitest'

// Runs the bundled main thread against a fake `figma` global, the way Figma runs it: one script, no imports, no DOM.

let source = ''
beforeAll(async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../src/code.ts', import.meta.url))],
    bundle: true, write: false, format: 'iife', target: 'es2020', platform: 'neutral',
  })
  source = result.outputFiles[0]!.text
})

type Fake = ReturnType<typeof fakeFigma>

function fakeText(id: string, characters: string, events: string[]) {
  const node = {
    id, name: `Layer ${id}`, type: 'TEXT', visible: true, removed: false, hasMissingFont: false,
    absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 20 },
    textAlignHorizontal: 'RIGHT', textAutoResize: 'HEIGHT', fontName: { family: 'Inter', style: 'Regular' },
    _characters: characters,
    get characters() { return this._characters },
    set characters(v: string) { events.push(`set ${id}`); this._characters = v },
    getRangeAllFontNames: () => [{ family: 'Inter', style: 'Regular' }],
    getStyledTextSegments: () => [{
      characters, start: 0, end: characters.length, fontName: { family: 'Inter', style: 'Regular' }, fontSize: 16, fontWeight: 400,
      fontStyle: 'REGULAR', letterSpacing: { unit: 'PIXELS', value: 0 }, lineHeight: { unit: 'AUTO' },
    }],
  }
  return node
}

function fakeFigma(command: string) {
  const events: string[] = []
  const posted: Array<{ type: string } & Record<string, unknown>> = []
  const notes: string[] = []
  const a = fakeText('1:1', 'مرحبا', events)
  const b = { ...fakeText('1:2', 'x', events), hasMissingFont: true }
  const page1 = { id: 'p:1', name: 'Page 1', type: 'PAGE', selection: [] as unknown[] }
  const page2 = { id: 'p:2', name: 'Page 2', type: 'PAGE', selection: [] as unknown[] }
  const frame = { id: '0:1', name: 'Screen', type: 'FRAME', visible: true, removed: false, layoutMode: 'VERTICAL', absoluteBoundingBox: { x: 0, y: 0, width: 390, height: 800 }, children: [a, b], parent: page1 }
  Object.assign(a, { parent: frame })
  Object.assign(b, { parent: frame })
  const other = { ...fakeText('2:1', 'other', events), parent: page2 }
  const nodes = new Map<string, unknown>([['0:1', frame], ['1:1', a], ['1:2', b], ['2:1', other], ['p:1', page1]])
  page1.selection = [frame]
  const figma = {
    command,
    currentPage: page1 as { selection: unknown[]; id?: string },
    setCurrentPageAsync: async (page: typeof page1) => { events.push(`page ${page.id}`); figma.currentPage = page },
    viewport: { scrollAndZoomIntoView: (n: Array<{ id: string }>) => events.push(`zoom ${n[0]!.id}`) },
    showUI: () => events.push('showUI'),
    ui: { postMessage: (m: { type: string }) => posted.push(m), onmessage: null as null | ((m: unknown) => void) },
    notify: (s: string) => notes.push(s),
    openExternal: (url: string) => events.push(`open ${url}`),
    loadFontAsync: async (f: { family: string }) => { events.push(`load ${f.family}`) },
    getNodeByIdAsync: async (id: string) => nodes.get(id) ?? null,
  }
  return { figma, events, posted, notes, frame }
}

function run(command: string): Fake {
  const fake = fakeFigma(command)
  runInNewContext(source, { figma: fake.figma, __html__: '<html></html>', console })
  return fake
}

const send = async (fake: Fake, message: unknown): Promise<void> => {
  fake.figma.ui.onmessage?.(message)
  await new Promise((r) => setImmediate(r))
}

describe('main thread', () => {
  it('opens the UI and tells it which command ran', async () => {
    const fake = run('fill')
    expect(fake.events).toContain('showUI')
    await send(fake, { type: 'ready' })
    expect(fake.posted.at(-1)).toEqual({ type: 'mode', mode: 'fill' })
  })

  it('sends a plain snapshot of the selected frame', async () => {
    const fake = run('check')
    await send(fake, { type: 'check' })
    const last = fake.posted.at(-1)!
    expect(last).toMatchObject({ type: 'snapshot', note: null, root: { kind: 'container', id: '0:1' } })
    fake.figma.currentPage.selection = []
    await send(fake, { type: 'check' })
    expect(fake.posted.at(-1)).toEqual({ type: 'snapshot', root: null, note: 'Select a frame to check.' })
    fake.figma.currentPage.selection = [fake.frame, fake.frame]
    await send(fake, { type: 'check' })
    expect(fake.posted.at(-1)!.note).toMatch(/one frame at a time/)
  })

  it('selects and zooms to a layer from a finding', async () => {
    const fake = run('check')
    await send(fake, { type: 'select', id: '1:1' })
    expect(fake.figma.currentPage.selection[0]).toMatchObject({ id: '1:1' })
    expect(fake.events).toContain('zoom 1:1')
    expect(fake.events).not.toContain('page p:1')
    await send(fake, { type: 'select', id: '9:9' })
    expect(fake.notes.at(-1)).toMatch(/no longer in the file/)
  })

  it('switches to the layer\'s page before selecting it', async () => {
    const fake = run('check')
    await send(fake, { type: 'select', id: '2:1' })
    expect(fake.events.slice(-2)).toEqual(['page p:2', 'zoom 2:1'])
    expect(fake.figma.currentPage).toMatchObject({ id: 'p:2', selection: [{ id: '2:1' }] })
  })

  it('does not try to select a page', async () => {
    const fake = run('check')
    await send(fake, { type: 'select', id: 'p:1' })
    expect(fake.notes.at(-1)).toMatch(/no longer in the file/)
    expect(fake.events.some((e) => e.startsWith('zoom'))).toBe(false)
  })

  it('ignores messages it does not recognise', async () => {
    const fake = run('check')
    const before = [fake.posted.length, fake.events.length, fake.notes.length]
    for (const raw of [null, 'check', { type: 'eval' }, { type: 'select', id: 1 }, { type: 'fill-apply', items: 'all' }]) await send(fake, raw)
    expect([fake.posted.length, fake.events.length, fake.notes.length]).toEqual(before)
  })

  it('opens only Dualkit documentation links', async () => {
    const fake = run('check')
    await send(fake, { type: 'open', url: 'https://github.com/dualkit/dualkit/blob/main/packages/rules/RULES.md#x' })
    await send(fake, { type: 'open', url: 'https://example.com/' })
    expect(fake.events.filter((e) => e.startsWith('open'))).toEqual(['open https://github.com/dualkit/dualkit/blob/main/packages/rules/RULES.md#x'])
  })

  it('lists the text layers to fill, then loads fonts before setting characters', async () => {
    const fake = run('fill')
    await send(fake, { type: 'fill-request' })
    expect(fake.posted.at(-1)).toEqual({ type: 'fill-layers', layers: [{ id: '1:1', name: 'Layer 1:1' }, { id: '1:2', name: 'Layer 1:2' }] })
    await send(fake, { type: 'fill-apply', items: [{ id: '1:1', kind: 'phone-ae', text: '050 123 4567' }, { id: '1:2', kind: 'phone-ae', text: 'y' }, { id: 5 }, { id: '1:1', kind: 'nope', text: 'z' }] })
    expect(fake.events.slice(-2)).toEqual(['load Inter', 'set 1:1'])
    expect(fake.posted.at(-1)).toEqual({ type: 'filled', filled: 1, skipped: ['1:2'] })
    expect(fake.notes.at(-1)).toMatch(/1 skipped/)
  })
})
