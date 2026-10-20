// Markup for the hero story panel, ported from design/prototypes/hero3/index.html. Pure strings, so the server
// renders the settled frame (fixed Arabic panel, rail on "Checked") and the client engine re-renders the broken
// frame when motion is allowed. Every node the engine drives carries data-k; classes are scoped by .v3-story.
import { V3 } from './copy'

const S = V3.story
export const AR = S.ar
export const EN = S.en
export const PHONE = S.values.phone
export const IBAN = S.values.iban
export const COMMAND = S.command

export type KeyName = 'amount' | 'date' | 'phone' | 'iban'
export type Pin = { index: number; row: 'h' | KeyName; side: 'l' | 'r'; title: string; line: string }
export const PINS: readonly Pin[] = S.pins.map((p, index) => ({ index, row: p.row as Pin['row'], side: p.side as Pin['side'], title: p.title, line: p.line }))
export type RailState = readonly [no: string, title: string, line: string]
export const RAIL = {
  build: S.rail.build as RailState,
  install: S.rail.install as RailState,
  checked: S.rail.checked as RailState,
  fix: (i: number): RailState => [String(i + 1).padStart(2, '0'), PINS[i]!.title, PINS[i]!.line],
}

const ZW = '‌'
/** An agent that knows no Arabic: letters forced apart with non-joiners and wide tracking. */
const broken = (s: string) => s.split(' ').map((w) => [...w].join(ZW)).join(' ')
/** Each word in its own span, so swaps can blur word by word. */
export const W = (txt: string) => txt.split(/( +)/).map((w) => (w.trim() ? `<span class="w2">${w}</span>` : w)).join('')
export const face = (html: string) => `<span class="face">${html}</span>`
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const odoStrip = (d: number) => `transform:translateY(${(-(10 + d) / 30) * 100}%)`
/** Odometer: a strip of 0 to 9 three times; the engine only ever moves forward, or back to the nearest copy. */
export const odoHTML = (str: string) =>
  [...str].map((c) => (/\d/.test(c)
    ? `<span class="od" data-d="${c}"><span style="${odoStrip(+c)}">${Array.from({ length: 30 }, (_, i) => `<i>${i % 10}</i>`).join('')}</span></span>`
    : `<span>${c}</span>`)).join('')
/** A digit in its own clipped slot: it rises in from below once, it never spins through other digits. */
const digHTML = (str: string) => [...str].map((c) => `<span class="dg"><i>${c}</i></span>`).join('')

export const ARROW = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5"/></svg>'
const CHECK = '<svg viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-4.9" stroke="#fff" stroke-width="1.5"/></svg>'

export const keyFace = {
  bk: (k: KeyName) => `<span class="k bk">${broken(AR[k])}</span>`,
  fx: (k: KeyName) => `<span class="k fx" dir="rtl">${W(AR[k])}</span>`,
  en: (k: KeyName) => `<span class="k en" dir="ltr">${W(EN[k])}</span>`,
}
export const TITLE = { bk: `<span class="t bk">${broken(AR.title)}</span>`, fx: `<span class="t fx" dir="rtl">${W(AR.title)}</span>`, en: `<span class="t en" dir="ltr">${W(EN.title)}</span>` }
export const PAY = { bk: `<span class="pay bk">${broken(AR.pay)}</span>`, fx: `<span class="pay fx" dir="rtl">${W(AR.pay)}</span>`, en: `<span class="pay en" dir="ltr">${W(EN.pay)}</span>` }
const [hijriDay, , hijriYear] = AR.dateValue.split(' ')
export const DATE = {
  bk: `<span class="v">${S.values.brokenDate}</span>`,
  fx: `<span class="va" dir="rtl"><span class="w2"><bdi class="v" dir="ltr">${digHTML(hijriDay!)}</bdi></span> <span class="w2">${AR.hijriMonth}</span> <span class="w2"><bdi class="v" dir="ltr">${digHTML(hijriYear!)}</bdi></span> <span class="w2">${AR.hijriEra}</span></span>`,
  en: `<span class="v" dir="ltr">${W(EN.dateValue)}</span>`,
}
const AMOUNT_CHARS = [...S.values.amount]
const AMOUNT_BK = `<span class="amt" dir="ltr"><span class="num v">${AMOUNT_CHARS.map((c, i) => {
  const last = i === AMOUNT_CHARS.length - 1, sep = c === ','
  return `<span class="ch${sep ? ' sep hide' : ''}${last ? ' z0 hide' : ''}">${last ? odoHTML(c) : c}</span>`
}).join('')}</span><span class="cur cell e"><span class="face"><span class="v">${S.values.currency}</span></span></span></span>`
export const AMOUNT_FX = `<span class="amt" dir="rtl"><span class="num v">${AMOUNT_CHARS.map((c) => `<span class="ch">${c}</span>`).join('')}</span><span class="cur cell e"><span class="face"><span class="va">${AR.currency}</span></span></span></span>`
export const CURRENCY_FX = `<span class="va">${AR.currency}</span>`
export const AMOUNT_EN = `<span class="v" dir="ltr">${W(EN.amountValue)}</span>`

const phoneHTML = (fixed: boolean) => {
  const chars = fixed ? [...PHONE] : [...PHONE].reverse()
  return `<span class="ph v" data-k="ph">${chars.map((c) => `<span class="ch">${c}</span>`).join('')}<svg class="phring" data-k="phring" aria-hidden="true"><rect x="0.5" y="0.5" pathLength="1"${fixed ? ' style="stroke-dashoffset:0"' : ''}/></svg><span class="chip"${fixed ? ' style="opacity:1"' : ''}>${esc(S.chips.bdi)}</span></span>`
}
const ibanHTML = (fixed: boolean) =>
  `<span class="ib v${fixed ? ' grouped' : ''}" data-k="ib">${[...IBAN].map((c, i) => `<span class="ch${i && i % 4 === 0 ? ' g0' : ''}" data-g="${Math.floor(i / 4)}"${fixed ? ' style="color:#fff"' : ''}>${c}</span>`).join('')}<span class="chip"${fixed ? ' style="opacity:1"' : ''}><i></i>${S.chips.iban}</span></span>`

const pinHTML = ({ index, side }: Pin, fixed: boolean) =>
  `<span class="pin ${side}" data-pin="${index}"${fixed ? ' style="opacity:0"' : ''}><span class="pq"><span class="pn">${index + 1}</span>${CHECK}</span></span>`
const pinsFor = (row: Pin['row'], fixed: boolean) => PINS.filter((p) => p.row === row).map((p) => pinHTML(p, fixed)).join('')

export const AR_FACES = { title: TITLE.fx, amountK: keyFace.fx('amount'), dateK: keyFace.fx('date'), phoneK: keyFace.fx('phone'), ibanK: keyFace.fx('iban'), pay: PAY.fx, amountV: AMOUNT_FX, dateV: DATE.fx }
export const EN_FACES = { title: TITLE.en, amountK: keyFace.en('amount'), dateK: keyFace.en('date'), phoneK: keyFace.en('phone'), ibanK: keyFace.en('iban'), pay: PAY.en, amountV: AMOUNT_EN, dateV: DATE.en }

/** The panel and the install strip. `settled` is the end of the loop in Arabic: every rule fixed and passing. */
export function panelHTML(settled: boolean): string {
  const f = settled
  const st = (css: string) => (f ? ` style="${css}"` : '')
  const kc = (k: KeyName) => `<span class="cell s" data-c="${k}K">${face(f ? keyFace.fx(k) : keyFace.bk(k))}</span>`
  const row = (k: KeyName, value: string) => `<div class="row" data-row="${k}"${st('opacity:1')}>${kc(k)}<span class="cell e" data-c="${k}V">${face(value)}</span>${pinsFor(k, f)}</div>`
  const [failing, passing] = f ? ['0', String(S.check.startFailing + S.check.startPassing)] : [String(S.check.startFailing), String(S.check.startPassing)]
  const roll = S.direction.values
  return `
<div class="panel${f ? ' typeset paid' : ''}" data-k="panel" dir="${f ? 'rtl' : 'ltr'}" lang="ar">
  <div class="bg" data-k="bg"${st('opacity:1')}></div>
  <div class="scanclip"><div class="spec" data-k="spec"></div></div>
  <svg class="ringbox" data-k="ringbox" aria-hidden="true"><rect data-k="ring" x="-0.5" y="-0.5" pathLength="1"${st('stroke-dashoffset:0;stroke-opacity:.14')}/></svg>
  <div class="scanclip" data-k="sweepclip"><div class="sweep" data-k="sweep"></div><div class="scan" data-k="scan"></div></div>
  <div class="content" data-k="content">
    <div class="row h" data-row="h"${st('opacity:1')}><span class="cell s" data-c="title">${face(f ? TITLE.fx : TITLE.bk)}</span><span class="badge">${S.direction.label} <span class="roll" data-k="roll">${[roll[0], roll[1], roll[0]].map((v) => `<span${st('transform:translateY(-100%)')}>${v}</span>`).join('')}</span></span>${pinsFor('h', f)}</div>
    <div class="row c" data-row="c"${st('opacity:1')}>
      <span class="grp" dir="ltr" data-k="grpA"><i class="state" data-k="state"${st('background:#3ecf6e;border-color:#3ecf6e')}></i><span class="mn">${S.check.name}</span><span class="mn">·</span><span class="mn" data-k="failN">${odoHTML(failing)}</span><span class="mn cell s" data-k="failW">${face(S.check.failing[1]!)}</span></span>
      <span class="grp" dir="ltr"><span class="track"><b data-k="bar" style="transform:scaleX(${+passing / 20})"></b></span><span class="mn" data-k="score">${odoHTML(passing)}</span><span class="mn">${S.check.of}</span></span>
    </div>
    ${row('amount', f ? AMOUNT_FX : AMOUNT_BK)}
    ${row('date', f ? DATE.fx : DATE.bk)}
    ${row('phone', phoneHTML(f))}
    ${row('iban', ibanHTML(f))}
    <div class="row b" data-row="pay"${st('opacity:1')}><div class="btnface" data-k="btnface"${st('background-color:#fff')}></div><span class="cell m paylabel" data-c="pay">${face(f ? PAY.fx : PAY.bk)}</span><span class="arw" data-k="arw"><span class="rot"${f ? ' style="display:block;transform:rotate(180deg)"' : ' style="display:block"'}>${ARROW}</span></span></div>
  </div>
</div>
<div class="istrip" data-k="strip"><div class="bg"></div><span class="icmd"><span class="p">$ </span><span data-k="typed"></span><span class="caret" data-k="caret"></span></span><span class="ld4" data-k="ld4"><span class="sq4">${'<i><b></b></i>'.repeat(4)}</span><span>${S.loaded}</span></span></div>`
}

/** Pause and play for the story, at the end of the tick row. Two hard-edged glyphs; CSS shows the one for the state. */
export const PAUSE_HTML = `<button type="button" class="pp" data-k="pp" aria-label="${V3.motion.pause}" aria-pressed="false"><i><svg class="pp-pause" viewBox="0 0 8 8" width="8" height="8" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="M1 0h2v8H1zM5 0h2v8H5z"/></svg><svg class="pp-play" viewBox="0 0 8 8" width="8" height="8" aria-hidden="true"><path fill="currentColor" d="M1 0l7 4-7 4z"/></svg></i></button>`

const tickLabel = (title: string) => `Show ${/^[A-Z]{2,}/.test(title) ? title : title[0]!.toLowerCase() + title.slice(1)}`

/** The caption rail, settled on "Checked" with all six ticks filled. The list of rules shows under reduced motion. */
export function railHTML(): string {
  const [no, title, line] = RAIL.checked
  return `
<div class="bg"></div>
<div class="rhead"><span class="rno" data-k="rno">${odoHTML(no)}<span>&nbsp;/ 06</span></span><span class="rtitle" data-k="rtitle">${face(title)}</span></div>
<div class="rline" data-k="rline">${face(line)}</div>
<ol class="rlist">${PINS.map((p) => `<li><b>${p.title}.</b> ${p.line}</li>`).join('')}</ol>
<div class="tks" data-k="ticks">${PINS.map((p) => `<button type="button" aria-label="${tickLabel(p.title)}" data-tick="${p.index}"><i><b style="transform:scale(1)"></b></i></button>`).join('')}${PAUSE_HTML}</div>`
}

/** Everything inside the hero frame: the painting with its camera, and the rail. */
export function storyHTML(): string {
  return `<div class="painting" data-k="painting"><div class="sky" data-k="sky"></div><div class="cam" data-k="cam"><div class="group" data-k="group" aria-hidden="true">${panelHTML(true)}</div></div></div><div class="rail" data-k="rail">${railHTML()}</div>`
}
