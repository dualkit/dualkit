import { checkFrame, type CheckResult, type RuleGroup } from './check'
import type { Mode, ToMain, ToUi } from './messages'
import { SAMPLE_KINDS, SAMPLE_LABELS, fillPlan, type FillLayer, type FillOptions, type SampleKind } from './samples'

// The plugin window. It runs the rules and the sample generator, because the iframe has Intl and the main thread does not.
// Every piece of layer data is written with textContent, never as HTML.

const send = (message: ToMain): void => parent.postMessage({ pluginMessage: message }, '*')

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id)
  if (!el) throw new Error(`The plugin window is missing #${id}`)
  return el as T
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: { className?: string; text?: string } = {}, children: Node[] = []): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (props.className) node.className = props.className
  if (props.text !== undefined) node.textContent = props.text
  for (const child of children) node.append(child)
  return node
}

function showTab(mode: Mode): void {
  for (const m of ['check', 'fill'] as const) {
    $(`tab-${m}`).setAttribute('aria-selected', String(m === mode))
    $(`panel-${m}`).hidden = m !== mode
  }
}

const SEVERITY_LABEL = { error: 'Error', warning: 'Warning', note: 'Note' } as const

function layerButton(layerId: string, layerName: string): HTMLButtonElement {
  const button = el('button', { className: 'hit', text: layerName || 'Layer' })
  button.title = 'Select and zoom to this layer'
  button.addEventListener('click', () => send({ type: 'select', id: layerId }))
  return button
}

function renderGroup(g: RuleGroup): HTMLElement {
  const hits = g.hits.map((h) => el('li', {}, [layerButton(h.layerId, h.layerName), el('span', { className: 'message', text: h.message })]))
  const link = el('a', { text: 'Pattern and examples' })
  link.href = g.docs
  link.addEventListener('click', (event) => {
    event.preventDefault()
    send({ type: 'open', url: g.docs })
  })
  return el('section', { className: `group ${g.severity}` }, [
    el('header', {}, [el('span', { className: 'badge', text: SEVERITY_LABEL[g.severity] }), el('h3', { text: g.title }), el('code', { text: g.rule })]),
    el('p', { className: 'fix', text: g.fix }),
    el('ul', { className: 'hits' }, hits),
    link,
  ])
}

function renderResult(result: CheckResult, note: string | null): void {
  const total = result.findings.length
  const summary = total === 0
    ? `No problems found in ${result.layers} text layers by the rules that run in Figma.`
    : `${total} ${total === 1 ? 'problem' : 'problems'} in ${result.layers} text layers.`
  const n = result.unread.length
  const unread = n === 0 ? null
    : `${n} ${n === 1 ? 'layer has' : 'layers have'} text the plugin could not read, so ${n === 1 ? 'it was' : 'they were'} only partly checked.`
  $('check-status').textContent = [summary, unread, note].filter(Boolean).join(' ')
  $('unread').replaceChildren(...result.unread.map((u) => el('li', {}, [layerButton(u.layerId, u.layerName)])))
  $('results').replaceChildren(...result.groups.map(renderGroup))
  $('skipped-count').textContent = String(result.notChecked.length)
  $('skipped').replaceChildren(...result.notChecked.map((r) =>
    el('li', {}, [el('strong', { text: r.title }), el('code', { text: r.id }), el('span', { text: r.reason })])))
}

function onSnapshot(message: Extract<ToUi, { type: 'snapshot' }>): void {
  if (message.root === null) {
    $('check-status').textContent = message.note ?? 'Select a frame to check.'
    $('results').replaceChildren()
    $('unread').replaceChildren()
    return
  }
  try {
    renderResult(checkFrame(message.root), message.note)
  } catch (error: unknown) {
    console.error('Dualkit check failed', error)
    $('check-status').textContent = 'The check could not run on this selection. Open the developer console for details.'
  }
}

function fillOptions(): FillOptions {
  const language = $<HTMLSelectElement>('fill-language').value
  const seed = Number.parseInt($<HTMLInputElement>('fill-seed').value, 10)
  const kind = $<HTMLSelectElement>('fill-kind').value
  return {
    seed: Number.isFinite(seed) ? seed : 1,
    locale: language === 'en' ? 'en' : 'ar',
    numerals: language === 'ar-arab' ? 'arab' : 'latn',
    kind: (SAMPLE_KINDS as readonly string[]).includes(kind) ? (kind as SampleKind) : 'auto',
  }
}

function onFillLayers(layers: FillLayer[]): void {
  if (layers.length === 0) {
    $('fill-status').textContent = 'Select text layers, or a frame that holds them.'
    return
  }
  try {
    send({ type: 'fill-apply', items: fillPlan(layers, fillOptions()) })
    $('fill-status').textContent = `Filling ${layers.length} layers…`
  } catch (error: unknown) {
    console.error('Dualkit samples failed', error)
    $('fill-status').textContent = 'The samples could not be made here. Hijri dates need the Umm al-Qura calendar in this Figma build.'
  }
}

function onMessage(message: ToUi): void {
  switch (message.type) {
    case 'mode':
      showTab(message.mode)
      if (message.mode === 'check') send({ type: 'check' })
      return
    case 'snapshot': return onSnapshot(message)
    case 'fill-layers': return onFillLayers(message.layers)
    case 'filled':
      $('fill-status').textContent = message.skipped.length === 0
        ? `Filled ${message.filled} layers.`
        : `Filled ${message.filled} layers. Skipped ${message.skipped.length}: a font is missing or the layer changed.`
  }
}

function init(): void {
  const kind = $<HTMLSelectElement>('fill-kind')
  for (const k of SAMPLE_KINDS) {
    const option = el('option', { text: SAMPLE_LABELS[k] })
    option.value = k
    kind.append(option)
  }
  $('tab-check').addEventListener('click', () => { showTab('check'); send({ type: 'check' }) })
  $('tab-fill').addEventListener('click', () => showTab('fill'))
  $('check-run').addEventListener('click', () => send({ type: 'check' }))
  $('fill-run').addEventListener('click', () => send({ type: 'fill-request' }))
  window.addEventListener('message', (event: MessageEvent<{ pluginMessage?: ToUi }>) => {
    const message = event.data?.pluginMessage
    if (message) onMessage(message)
  })
  send({ type: 'ready' })
}

init()
