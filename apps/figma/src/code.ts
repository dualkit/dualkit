import { parseToMain } from './guards'
import type { Mode, ToUi } from './messages'
import { collectTextLayers, snapshot, type LiveNode } from './snapshot'

// The plugin's main thread. It reads and writes layers and nothing else: the rules and the sample generator run in the UI,
// which has Intl and the full regular expression engine.

const UI_SIZE = { width: 360, height: 560 }
const DOCS_ORIGINS = ['https://github.com/dualkit/', 'https://dualkit.dev/']

const post = (message: ToUi): void => figma.ui.postMessage(message)

// Plugin API scene nodes carry far more than LiveNode lists; this is the one place they are narrowed to it.
const asLive = (nodes: readonly SceneNode[]): readonly LiveNode[] => nodes as unknown as readonly LiveNode[]

function sendSnapshot(): void {
  const selection = figma.currentPage.selection
  const first = selection[0]
  if (!first) {
    post({ type: 'snapshot', root: null, note: 'Select a frame to check.' })
    return
  }
  const note = selection.length > 1 ? `Checked "${first.name}" only. Select one frame at a time.` : null
  post({ type: 'snapshot', root: snapshot(asLive([first])[0]!), note })
}

const isSceneNode = (node: BaseNode | null): node is SceneNode =>
  node !== null && !node.removed && node.type !== 'PAGE' && node.type !== 'DOCUMENT'

/** The page a layer sits on, found by walking up its parents. */
function pageOf(node: SceneNode): PageNode | null {
  let current: BaseNode | null = node.parent
  while (current && current.type !== 'PAGE') current = current.parent
  return current
}

async function selectLayer(id: string): Promise<void> {
  const node = await figma.getNodeByIdAsync(id)
  if (!isSceneNode(node)) {
    figma.notify('That layer is no longer in the file.')
    return
  }
  // The person may have moved to another page since the check; selection only works on the current page.
  const page = pageOf(node)
  if (page && page.id !== figma.currentPage.id) await figma.setCurrentPageAsync(page)
  figma.currentPage.selection = [node]
  figma.viewport.scrollAndZoomIntoView([node])
}

async function fillOne(id: string, text: string): Promise<boolean> {
  const node = await figma.getNodeByIdAsync(id)
  if (!node || node.type !== 'TEXT' || node.hasMissingFont) return false
  const fonts = node.characters.length > 0 ? node.getRangeAllFontNames(0, node.characters.length) : [node.fontName]
  await Promise.all(fonts.filter((f): f is FontName => typeof f !== 'symbol').map((f) => figma.loadFontAsync(f)))
  node.characters = text
  return true
}

async function applyFill(items: ReadonlyArray<{ id: string; text: string }>): Promise<void> {
  const skipped: string[] = []
  let filled = 0
  for (const item of items) {
    try {
      if (await fillOne(item.id, item.text)) filled += 1
      else skipped.push(item.id)
    } catch (error: unknown) {
      console.error('Dualkit could not fill a layer', item.id, error)
      skipped.push(item.id)
    }
  }
  figma.notify(skipped.length === 0 ? `Filled ${filled} layers.` : `Filled ${filled} layers. ${skipped.length} skipped: a font is missing or the layer changed.`)
  post({ type: 'filled', filled, skipped })
}

function sendFillLayers(): void {
  const layers = collectTextLayers(asLive(figma.currentPage.selection)).map(({ id, name }) => ({ id, name }))
  if (layers.length === 0) figma.notify('Select text layers, or a frame that holds them.')
  post({ type: 'fill-layers', layers })
}

async function onMessage(raw: unknown): Promise<void> {
  const message = parseToMain(raw)
  if (message === null) return
  switch (message.type) {
    case 'ready': return post({ type: 'mode', mode })
    case 'check': return sendSnapshot()
    case 'select': return selectLayer(message.id)
    case 'open':
      if (DOCS_ORIGINS.some((o) => message.url.startsWith(o))) figma.openExternal(message.url)
      return
    case 'fill-request': return sendFillLayers()
    case 'fill-apply': return applyFill(message.items)
  }
}

const mode: Mode = figma.command === 'fill' ? 'fill' : 'check'
figma.showUI(__html__, { ...UI_SIZE, themeColors: true, title: mode === 'fill' ? 'Dualkit: Fill Gulf samples' : 'Dualkit: Check frame' })
figma.ui.onmessage = (raw: unknown) => {
  onMessage(raw).catch((error: unknown) => {
    console.error('Dualkit plugin error', error)
    figma.notify('Something went wrong. Open the developer console for details.', { error: true })
  })
}
