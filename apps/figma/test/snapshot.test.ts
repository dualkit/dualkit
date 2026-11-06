import { describe, expect, it } from 'vitest'
import { collectTextLayers, snapshot, type LiveNode, type LiveText, type SegmentField } from '../src/snapshot'

const MIXED = Symbol('figma.mixed')

function liveText(id: string, characters: string, extra: Partial<LiveText> = {}): LiveText {
  return {
    id, name: `Text ${id}`, type: 'TEXT', visible: true, characters,
    absoluteBoundingBox: { x: 10, y: 20, width: 100, height: 24 }, width: 100, height: 24,
    textAlignHorizontal: 'RIGHT', textAutoResize: 'HEIGHT',
    getStyledTextSegments: (fields: SegmentField[]) => {
      expect(fields).toEqual(['fontName', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight'])
      return [{
        characters, start: 0, end: characters.length,
        fontName: { family: 'Inter', style: 'Regular' }, fontSize: 16, fontWeight: 400, fontStyle: 'REGULAR',
        letterSpacing: { unit: 'PIXELS', value: 0 }, lineHeight: { unit: 'AUTO' },
      }]
    },
    ...extra,
  }
}

const liveFrame = (id: string, children: LiveNode[], extra: Partial<LiveNode> = {}): LiveNode => ({
  id, name: `Frame ${id}`, type: 'FRAME', visible: true, layoutMode: 'HORIZONTAL',
  absoluteBoundingBox: { x: 0, y: 0, width: 390, height: 844 }, width: 390, height: 844, children, ...extra,
})

describe('snapshot', () => {
  it('copies a frame tree into plain data with styled segments', () => {
    const shot = snapshot(liveFrame('0:1', [liveText('1:1', 'مرحبا')]))
    expect(shot).toMatchObject({ kind: 'container', id: '0:1', type: 'FRAME', layoutMode: 'HORIZONTAL' })
    if (shot.kind !== 'container') throw new Error('expected a container')
    expect(shot.children[0]).toMatchObject({
      kind: 'text', id: '1:1', name: 'Text 1:1', characters: 'مرحبا', parentLayoutMode: 'HORIZONTAL',
      box: { x: 10, y: 20, width: 100, height: 24 },
      segments: [{ fontName: { family: 'Inter', style: 'Regular' }, fontSize: 16 }],
    })
    expect(JSON.parse(JSON.stringify(shot))).toEqual(shot)
  })

  it('leaves out hidden layers and everything under them', () => {
    const shot = snapshot(liveFrame('0:1', [
      liveText('1:1', 'shown'),
      liveText('1:2', 'hidden', { visible: false }),
      liveFrame('0:2', [liveText('1:3', 'under hidden')], { visible: false }),
    ]))
    if (shot.kind !== 'container') throw new Error('expected a container')
    expect(shot.children.map((c) => c.id)).toEqual(['1:1'])
  })

  it('falls back to width and height when a node has no bounding box', () => {
    const shot = snapshot(liveText('1:1', 'x', { absoluteBoundingBox: null }))
    expect(shot.box).toEqual({ x: 0, y: 0, width: 100, height: 24 })
    const bare = snapshot({ id: '2:1', name: 'Group', type: 'GROUP' })
    expect(bare).toMatchObject({ box: { x: 0, y: 0, width: 0, height: 0 }, layoutMode: null, children: [] })
  })

  it('drops segments whose values are mixed', () => {
    const node = liveText('1:1', 'ab', {
      getStyledTextSegments: () => [{ characters: 'ab', start: 0, end: 2, fontName: MIXED, fontSize: 16, fontWeight: 400, fontStyle: 'REGULAR', letterSpacing: { unit: 'PIXELS', value: 0 }, lineHeight: { unit: 'AUTO' } }],
    })
    const shot = snapshot(node)
    if (shot.kind !== 'text') throw new Error('expected text')
    expect(shot.segments).toEqual([])
  })

  it('treats a text root as having no auto-layout parent', () => {
    const shot = snapshot(liveText('1:1', 'x'))
    expect(shot).toMatchObject({ kind: 'text', parentLayoutMode: null })
  })
})

describe('collectTextLayers', () => {
  it('finds selected text layers and the text inside selected frames, once each, skipping hidden ones', () => {
    const shared = liveText('1:1', 'a')
    const layers = collectTextLayers([
      shared,
      liveFrame('0:1', [shared, liveText('1:2', 'b'), liveFrame('0:2', [liveText('1:3', 'c')]), liveText('1:4', 'd', { visible: false })]),
      { id: '3:1', name: 'Rectangle', type: 'RECTANGLE' },
    ])
    expect(layers.map((l) => [l.id, l.name])).toEqual([['1:1', 'Text 1:1'], ['1:2', 'Text 1:2'], ['1:3', 'Text 1:3']])
  })
})
