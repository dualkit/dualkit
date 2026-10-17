import type { FieldNode, IconNode, LayoutNode, ScreenModel, TextRun } from '../../src/model'

const base = { id: 'p', snippet: '<p>', box: { x: 0, y: 0, width: 100, height: 20 } }

export const text = (p: Partial<TextRun> = {}): TextRun => ({
  ...base, text: 'مرحبا', blockId: 'p', blockText: p.text ?? 'مرحبا', blockDir: 'rtl', dir: 'rtl', lang: 'ar',
  isolated: false, isLastInBlock: true,
  font: { families: ['IBM Plex Sans Arabic', 'sans-serif'], size: 16, lineHeight: 27, letterSpacing: 0, style: 'normal', weight: 400 },
  lines: 1, ...p,
})
export const layout = (p: Partial<LayoutNode> = {}): LayoutNode => ({ ...base, dir: 'rtl', textAlign: 'start', hasOwnText: true, hasArabicText: true, physical: [], ...p })
export const icon = (p: Partial<IconNode> = {}): IconNode => ({ ...base, name: 'arrow-right', dir: 'rtl', mirrored: false, ...p })
export const field = (p: Partial<FieldNode> = {}): FieldNode => ({ ...base, kind: 'email', dir: 'rtl', dirAttr: null, ...p })
export const screen = (p: Partial<ScreenModel> = {}): ScreenModel => ({
  root: { lang: 'ar', dir: 'rtl' }, texts: [], layouts: [], icons: [], fields: [], unreadableStylesheets: 0, ...p,
})
