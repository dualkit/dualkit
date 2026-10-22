// The report's stylesheet. No webfonts and no network: the system stack, tuned to read like the Dualkit site.
import { WIDE_VIEW_PX } from './view'

const SANS = 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif'
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'

const TOKENS = `
:root{--ground:#fafafa;--card:#fff;--well:#f4f4f5;--ink:#09090b;--soft:rgba(0,0,0,.6);--faint:rgba(0,0,0,.42);--line:rgba(0,0,0,.08);--track:rgba(0,0,0,.07);--err:#dc2626;--warn:#b45309;--note:#71717a;--logo2:#cfcfd4}
@media (prefers-color-scheme:dark){:root{--ground:#0b0b0c;--card:#141416;--well:#1c1c1f;--ink:#f4f4f5;--soft:rgba(255,255,255,.64);--faint:rgba(255,255,255,.44);--line:rgba(255,255,255,.1);--track:rgba(255,255,255,.1);--err:#ef4444;--warn:#d97706;--note:#a1a1aa;--logo2:#52525b}}
.error{--c:var(--err)}.warning{--c:var(--warn)}.note{--c:var(--note)}`

const BASE = `
*{box-sizing:border-box}html{background:var(--ground);color-scheme:light dark}
body{margin:0;background:var(--ground);color:var(--ink);font:15px/1.55 ${SANS};-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration-thickness:1px;text-underline-offset:3px}
.wrap{max-width:1180px;margin:0 auto;padding:48px 32px 88px}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:80px}
.brand{display:flex;align-items:center;gap:10px;font-weight:500;flex:none}.logo{width:20px;height:20px}.l1{fill:var(--ink)}.l2{fill:var(--logo2)}
.meta{margin:0;display:grid;gap:2px;justify-items:end;text-align:end;font-size:13px;line-height:1.45;color:var(--soft);min-width:0}
.url{overflow-wrap:anywhere;max-width:60ch;color:var(--ink)}`

const HERO = `
.hero{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:80px;align-items:end}
.score{margin:0;font-size:128px;font-weight:500;line-height:.82;letter-spacing:-.055em;font-variant-numeric:tabular-nums}
.score small{font-size:24px;font-weight:400;letter-spacing:-.01em;color:var(--faint);margin-inline-start:8px}
.verdict{margin:40px 0 0;font-size:40px;line-height:1.1;letter-spacing:-.03em;font-weight:500;text-wrap:balance}
.verdict span{color:var(--faint)}
.notice{margin:20px 0 0;font-size:14px;color:var(--soft)}
.counts{display:flex;flex-wrap:wrap;gap:8px 28px;margin:0 0 28px;font-size:14px}
.counts span{display:inline-flex;align-items:center;gap:8px}
.dot{display:inline-block;width:8px;height:8px;border-radius:999px;background:var(--c)}
.dot.error{--c:var(--err)}.dot.warning{--c:var(--warn)}
.fams{display:grid;gap:12px}
.fam{display:grid;grid-template-columns:64px minmax(0,1fr) 24px;gap:14px;align-items:center;font-size:13px;color:var(--soft)}
.track{height:6px;border-radius:999px;background:var(--track);overflow:hidden}.track b{display:block;height:100%;border-radius:inherit;background:var(--ink)}
.fam .n{text-align:end;color:var(--ink);font-variant-numeric:tabular-nums}`

const CARDS = `
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:104px}
.card{background:var(--card);border-radius:6px;box-shadow:inset 0 0 0 1px var(--line)}
.ev{padding:10px;display:flex;flex-direction:column}
.body{padding:22px 14px 14px;display:flex;flex-direction:column;flex:1}
.head{margin:0;display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;font-size:13px;color:var(--soft)}
.badge{padding:1px 8px;border-radius:999px;box-shadow:inset 0 0 0 1px var(--faint);color:var(--faint);font-size:12px;line-height:1.5}
.rid{font:12px/1.4 ${MONO};color:var(--faint);overflow-wrap:anywhere}
.pin-static{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:var(--c);color:#fff;font-size:12px;font-weight:600;font-variant-numeric:tabular-nums}
h3{margin:12px 0 0;font-size:19px;line-height:1.3;font-weight:500;letter-spacing:-.015em}
.fix{margin:8px 0 0;color:var(--soft)}.why{color:var(--ink);white-space:nowrap}
.seen{margin-top:18px;padding:12px 14px;border-radius:4px;background:var(--well)}
.seen p,.what p{margin:0;font-size:14px;line-height:1.5}
code{display:block;margin-top:4px;font:12px/1.5 ${MONO};color:var(--faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;unicode-bidi:isolate}
details{margin-top:auto;padding-top:16px}
summary{display:inline-flex;align-items:center;gap:6px;padding:7px 14px 7px 10px;border-radius:999px;box-shadow:inset 0 0 0 1px var(--line);font-size:13px;color:var(--soft);cursor:pointer;list-style:none;user-select:none}
summary::-webkit-details-marker{display:none}summary:hover{color:var(--ink)}
summary svg{width:14px;height:14px;transition:transform .15s ease}details[open] summary svg{transform:rotate(90deg)}
.instances{list-style:none;margin:20px 0 0;padding:0;display:grid;gap:24px}
.instances li{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:start}
.what{min-width:0}.what .view{margin:10px 0 0}
.page-level{display:flex;flex-direction:column;justify-content:flex-end;gap:10px;min-height:200px;padding:24px;border-radius:4px;background:var(--well)}
.where{margin:0;display:flex;align-items:center;gap:8px;font-size:13px;color:var(--soft)}.where svg{width:16px;height:16px;flex:none}
.said{margin:0;font-size:21px;line-height:1.3;font-weight:500;letter-spacing:-.015em;text-wrap:pretty}
.clean{margin-top:104px;padding:40px;font-size:17px}.clean p{margin:0}.clean p+p{margin-top:6px;color:var(--soft);font-size:15px}`

const VIEWS = `
.view{position:relative;width:100%;margin-inline:auto;container-type:inline-size;border-radius:4px;overflow:hidden;background-color:#fff;background-image:var(--shot);background-repeat:no-repeat;box-shadow:inset 0 0 0 1px var(--line)}
.ring{position:absolute;border-radius:3px;outline:1.5px solid var(--c);outline-offset:3px;background:color-mix(in srgb,var(--c) 6%,transparent);pointer-events:none}
.layer{position:absolute;inset:0}.layer.wide{display:none}
@container (min-width:${WIDE_VIEW_PX}px){.layer.narrow{display:none}.layer.wide{display:block}}
.leaders{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.leaders line{stroke:var(--c);stroke-width:1;vector-effect:non-scaling-stroke}
.pin{position:absolute;display:block;text-decoration:none}
.pin i{position:absolute;display:grid;place-items:center;height:var(--h);width:calc(var(--h)*var(--r));left:calc(50% - var(--h)*var(--r)/2);top:calc(50% - var(--h)/2);border-radius:999px;background:var(--c);color:#fff;font:600 calc(var(--h)*.5)/1 ${SANS};font-style:normal;font-variant-numeric:tabular-nums;box-shadow:0 0 0 1.5px #fff}
.hug-s i{left:0}.hug-e i{left:auto;right:0}.hug-b i{top:auto;bottom:0}.hug-t i{top:0}
.full{margin-top:128px}.full h2{margin:0;font-size:28px;font-weight:500;letter-spacing:-.03em}.full .lede{margin:6px 0 24px;color:var(--soft)}
.stage{padding:10px}
.foot{margin-top:96px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 24px;font-size:13px;color:var(--faint)}.foot p{margin:0}`

const RESPONSIVE = `
@media (max-width:760px){.wrap{padding:28px 16px 64px}.top{flex-direction:column;gap:20px;margin-bottom:56px}.meta{justify-items:start;text-align:start}
.hero{grid-template-columns:minmax(0,1fr);gap:44px}.score{font-size:96px}.verdict{margin-top:28px;font-size:29px;line-height:1.12}
.grid{grid-template-columns:minmax(0,1fr);margin-top:64px}.clean{margin-top:64px;padding:28px}.full{margin-top:88px}.page-level{min-height:160px;padding:20px}.said{font-size:19px}}
@media print{html,body{background:#fff}.wrap{max-width:none;padding:0}.card{break-inside:avoid}.full{break-before:page}
.view,.pin i,.pin-static,.dot,.track,.track b,.page-level,.seen{-webkit-print-color-adjust:exact;print-color-adjust:exact}
details::details-content{content-visibility:visible}summary{box-shadow:none;padding-inline:0}summary svg{display:none}}
@media (prefers-reduced-motion:reduce){summary svg{transition:none}}`

export const styles = (shotUrl: string): string =>
  `:root{--shot:${shotUrl}}${TOKENS}${BASE}${HERO}${CARDS}${VIEWS}${RESPONSIVE}`
