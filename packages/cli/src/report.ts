import type { Finding } from '@dualkit/rules'
import type { AuditResult } from './audit'
import { groupByRule } from './summary'

export const MAX_PER_RULE = 20
const BADGE_ROOM = 24

export const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const pct = (n: number, of: number) => `${Math.max(0, Math.min(100, (n / of) * 100)).toFixed(3)}%`

function markers(result: AuditResult, numbered: Array<{ n: number; f: Finding }>): string {
  return numbered
    .filter(({ f }) => f.node && f.node.box.y < result.pageHeight)
    .map(({ n, f }) => {
      const b = f.node!.box
      const height = Math.min(b.height, result.pageHeight - Math.max(0, b.y))
      return `<a class="mark${b.y < BADGE_ROOM ? ' top' : ''} ${f.severity}" href="#i${n}" style="left:${pct(b.x, result.width)};top:${pct(b.y, result.pageHeight)};width:${pct(b.width, result.width)};height:${pct(height, result.pageHeight)}"><span>${n}</span></a>`
    })
    .join('')
}

const CSS = `
:root{--ink:#09090b;--soft:#52525b;--line:#e4e4e7;--bg:#fafafa;--err:#dc2626;--warn:#d97706;--note:#71717a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 ui-sans-serif,system-ui,sans-serif}
main{max-width:1200px;margin:0 auto;padding:48px 24px}h1{font-size:28px;font-weight:500;margin:0 0 4px}
.meta{color:var(--soft);margin:0 0 32px;word-break:break-all}.score{font-size:72px;font-weight:500;letter-spacing:-.04em;line-height:1}
.grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:32px;align-items:start}
@media (max-width:900px){.grid{grid-template-columns:minmax(0,1fr)}}
.shot{position:relative;border-radius:6px;overflow:hidden;box-shadow:0 0 0 1px var(--line)}.shot img{display:block;width:100%}
.mark{position:absolute;outline:2px solid currentColor;outline-offset:1px;border-radius:2px}.mark span{position:absolute;inset-inline-start:-2px;top:-20px;background:var(--c);border-radius:4px;padding:0 5px;font-size:11px}
.mark.top span{top:0;inset-inline-start:0;border-start-start-radius:0}.mark span{color:#fff}.error{color:var(--err);--c:var(--err)}.warning{color:var(--warn);--c:var(--warn)}.note{color:var(--note);--c:var(--note)}
section.rule{background:#fff;border-radius:6px;box-shadow:0 0 0 1px var(--line);padding:24px;margin-bottom:16px}
section.rule h2{font-size:17px;font-weight:500;margin:0}.id{font-family:ui-monospace,monospace;font-size:12px;color:var(--soft)}
.fix{margin:8px 0 12px}ol{margin:0;padding-inline-start:20px}li{margin:8px 0}code{unicode-bidi:isolate;font-family:ui-monospace,monospace;font-size:12px;background:var(--bg);padding:2px 4px;border-radius:3px;word-break:break-all}
.notice{color:var(--soft)}footer{margin-top:48px;color:var(--soft);font-size:13px}a{color:inherit}`

export function renderReport(result: AuditResult): string {
  let n = 0
  const numbered: Array<{ n: number; f: Finding }> = []
  const sections = groupByRule(result.findings).map((group) => {
    const f = group[0]!
    const shown = group.slice(0, MAX_PER_RULE).map((x) => ({ n: ++n, f: x }))
    numbered.push(...shown)
    const items = shown.map(({ n: i, f: x }) =>
      `<li id="i${i}"><strong>${i}.</strong> <bdi dir="ltr">${escapeHtml(x.message)}</bdi>${x.node ? `<br><code dir="ltr">${escapeHtml(x.node.snippet)}</code>` : ''}</li>`).join('')
    const more = group.length > MAX_PER_RULE ? `<p class="notice">And ${group.length - MAX_PER_RULE} more.</p>` : ''
    return `<section class="rule"><p class="id ${f.severity}">${escapeHtml(f.severity)} · ${escapeHtml(f.rule)} · ${group.length}</p><h2>${escapeHtml(f.title)}</h2><p class="fix">${escapeHtml(f.fix)} <a href="${escapeHtml(f.docs)}">Why</a></p><ol>${items}</ol>${more}</section>`
  })
  const unreadable = result.unreadableStylesheets > 0
    ? `<p class="notice">${result.unreadableStylesheets} stylesheet${result.unreadableStylesheets === 1 ? '' : 's'} could not be read, so layout checks may miss rules in them.</p>`
    : ''
  const body = sections.length > 0 ? sections.join('') : '<p>No issues found. This screen is Gulf-ready by every Dualkit rule.</p>'
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gulf-ready report</title><style>${CSS}</style></head><body><main>
<h1>Gulf-ready report</h1><p class="meta">${escapeHtml(result.url)} · ${escapeHtml(result.date.slice(0, 10))} · ${result.width}px wide</p>
<div class="grid"><div><p class="score">${result.score}<span class="notice" style="font-size:20px">/100</span></p>${unreadable}${body}</div>
<div class="shot"><img alt="The audited screen" src="data:image/png;base64,${result.screenshot}">${markers(result, numbered)}</div></div>
<footer>Made with <a href="https://dualkit.dev">Dualkit</a>. Rules: <a href="https://github.com/dualkit/dualkit/blob/main/packages/rules/RULES.md">RULES.md</a></footer>
</main></body></html>`
}
