import type { Checklist } from './checklist.js'

type Item = { slot: number; left: Buffer; right: Buffer; checklist: Checklist }

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const img = (b: Buffer, side: string): string => `<img alt="${side} screen" src="data:image/png;base64,${b.toString('base64')}">`

const slot = (it: Item): string => `
<section class="slot" data-slot="${it.slot}" aria-label="Pair ${it.slot}">
  <h2>Pair ${it.slot}</h2>
  <div class="shots"><figure>${img(it.left, 'Left')}<figcaption>Left</figcaption></figure><figure>${img(it.right, 'Right')}<figcaption>Right</figcaption></figure></div>
  <ul class="points">${it.checklist.points.map((p) => `<li>${esc(p.text)}</li>`).join('')}</ul>
  <div class="picks" role="group" aria-label="Your pick for pair ${it.slot}">
    <button type="button" data-pick="left" aria-pressed="false">Left is better</button>
    <button type="button" data-pick="right" aria-pressed="false">Right is better</button>
    <button type="button" data-pick="same" aria-pressed="false">About the same</button>
  </div>
</section>`

const CSS = `
:root{--bg:#fbfaf8;--fg:#1c1b19;--muted:#5f5c56;--line:#d9d6cf;--card:#fff;--sel-bg:#1c1b19;--sel-fg:#fbfaf8}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--fg:#efede8;--muted:#a09c93;--line:#3a3935;--card:#1c1c1a;--sel-bg:#efede8;--sel-fg:#141413}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;overflow-wrap:anywhere}
main{max-width:860px;margin:0 auto;padding:32px 16px 96px}
h1{font-size:28px;line-height:1.2;margin:0 0 16px}
h2{font-size:18px;margin:0 0 16px}
.intro{color:var(--muted);margin:0 0 24px}
.progress{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);padding:12px 0;margin:0 0 24px;font-weight:600;z-index:1}
.slot{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:24px 16px;margin:0 0 24px}
.shots{display:flex;gap:12px;align-items:flex-start;margin:0 0 20px}
figure{margin:0;flex:1 1 0;min-width:0;max-width:50%}
figure img{display:block;width:100%;height:auto;border:1px solid var(--line);border-radius:8px}
figcaption{color:var(--muted);margin-top:8px;text-align:center}
.points{margin:0 0 20px;padding-left:20px}
.points li{margin:0 0 6px}
.picks{display:flex;flex-wrap:wrap;gap:8px}
button{font:inherit;color:var(--fg);background:transparent;border:1px solid var(--line);border-radius:8px;padding:12px 16px;min-height:44px;cursor:pointer}
button:hover{border-color:var(--fg)}
button:focus-visible{outline:2px solid var(--fg);outline-offset:2px}
button[aria-pressed="true"]{background:var(--sel-bg);color:var(--sel-fg);border-color:var(--sel-bg);font-weight:600}
.picks button{flex:1 1 140px}
.end{padding:24px 16px}
.end h2{margin-bottom:12px}
textarea{display:block;width:100%;min-height:120px;font:inherit;color:var(--fg);background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:12px;margin:0 0 16px}
.status{color:var(--muted);margin:12px 0 0}
`

const JS = `
(function(){
  var KEY='dk-calibration-v1', TOTAL=document.querySelectorAll('.slot').length, state={answers:{},note:''};
  try{var raw=localStorage.getItem(KEY);if(raw){var p=JSON.parse(raw);if(p&&p.answers)state=p}}catch(e){}
  var note=document.getElementById('note'), progress=document.getElementById('progress'), status=document.getElementById('status');
  function persist(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}}
  function paint(){
    document.querySelectorAll('.slot').forEach(function(s){
      var pick=state.answers[s.dataset.slot];
      s.querySelectorAll('button').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.pick===pick))});
    });
    progress.textContent=Object.keys(state.answers).length+' of '+TOTAL+' answered';
  }
  document.querySelectorAll('.slot button').forEach(function(b){
    b.addEventListener('click',function(){
      var next={};for(var k in state.answers)next[k]=state.answers[k];
      next[b.closest('.slot').dataset.slot]=b.dataset.pick;
      state={answers:next,note:state.note};persist();paint();
    });
  });
  note.value=state.note||'';
  note.addEventListener('input',function(){state={answers:state.answers,note:note.value};persist()});
  document.getElementById('save').addEventListener('click',function(){
    var answers=Object.keys(state.answers).map(Number).sort(function(a,b){return a-b}).map(function(n){return{slot:n,pick:state.answers[n]}});
    var blob=new Blob([JSON.stringify({answers:answers,note:note.value},null,2)],{type:'application/json'});
    var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='answers.json';document.body.appendChild(a);a.click();a.remove();
    status.textContent=answers.length<TOTAL?'Saved '+answers.length+' of '+TOTAL+'. You can come back and save again.':'Saved all '+TOTAL+'.';
  });
  paint();
})();
`

/** One self-contained blind page: no ids, models, files or conditions, only screenshots and checklists. */
export const calibrationPage = (items: Item[]): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Which is the better Arabic app?</title>
<style>${CSS}</style>
</head>
<body>
<main>
<h1>Which is the better Arabic app?</h1>
<p class="intro">Twenty pairs. Each shows the same screen built twice. Pick the one an Arabic reader would rather use, or say they are about the same. The checklist under each pair is what the judge looks at.</p>
<div class="progress" id="progress" aria-live="polite">0 of ${items.length} answered</div>
${items.map(slot).join('\n')}
<section class="end slot-end" style="border:1px solid var(--line);border-radius:12px;background:var(--card)">
<h2>Anything wrong with the checklists?</h2>
<textarea id="note" aria-label="Anything wrong with the checklists?"></textarea>
<button type="button" id="save">Save answers</button>
<p class="status" id="status" aria-live="polite"></p>
</section>
</main>
<script>${JS}</script>
</body>
</html>
`
