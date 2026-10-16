// Kierros 16.10.2026: lähetys ennen kuin Pi on käynnissä (proto-queued-send).
// Kaksi sisääntuloa: pysähtynyt keskustelu pitkällä historialla (Status-skripti, ei
// "Vain luku" -tilaa, kenttä käytössä; lähetys käynnistää Pi:n) ja uusi keskustelu
// tyhjässä työtilassa (muistiinpanot; kenttä käytössä heti, vaikka keskustelua vielä
// luodaan). Pi on valmis START_MS:n kuluttua; sitä ennen lähetetty viesti odottaa.
// Suunnat vaihtavat vain sen, missä odottava viesti on ja miltä se näyttää; Stop,
// järjestys ja epäonnistunut käynnistys toimivat kaikissa samoin. Täytön suunta ja
// kentän yllä oleva prosessi-/spinoff-kaista ovat toisen kierroksen akseli
// (2026-10-16-tayttosuunta), joten ne ovat tässä kirjaston mukaiset.
(() => {
const START_MS = 5000;
const ms = (t) => t * (document.getElementById('slow').checked ? 2.2 : 1);
const Q = { dir: 1, entry: 'stopped', pi: 'off', items: [], id: 0, timer: 0, stopped: false, retried: false, was: false, next: null, nc: null, gen: 0 };
const ICON_CLOCK = SVG('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>');
const ICON_WARN = SVG('<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5"/><path d="M12 17.2h.01"/>');
const ICON_STOP_Q = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/></svg>';

// ---------- Content ----------
// The stopped conversation ends with a settled turn: the person's next message is the one sent here.
if (CONVO[CONVO.length - 1].kind === 'user') CONVO.pop();
UI.ws.splice(2, 0, { id: 'muistiinpanot', path: '~/src/muistiinpanot', open: true, convs: [] });
const MSG = {
  stopped: ['Aja testit ja korjaa, mitä löytyy.', 'Lisää samalla README:hen esimerkki `--today`-lipusta.'],
  new: ['Kerro lyhyesti, mitä tässä hakemistossa on.', 'Ehdota sitten README:n rakenne.'],
};
const SHORT = {
  readme: { think: '**Adding a --today example to the README**', reply: 'Lisätty README:n Käyttö-osioon esimerkki `--today 2026-10-13`, ja sen alla kerrotaan, että lippu on tarkoitettu testeille ja toistettaviin ajoihin.' },
  ls: { think: '**Listing the workspace before answering**', tool: { name: 'bash', target: 'ls -la', args: { command: 'ls -la' }, lines: ['total 24', 'drwxr-xr-x  4 jari jari 4096 16.10. 18:02 .', '-rw-r--r--  1 jari jari  812 14.10. 09:11 2026-10-14.md', '-rw-r--r--  1 jari jari 1430 15.10. 21:40 2026-10-15.md', 'drwxr-xr-x  2 jari jari 4096 12.10. 08:03 kuvat'] },
    reply: 'Hakemistossa on kaksi päiväkohtaista muistiinpanoa (`2026-10-14.md` ja `2026-10-15.md`) ja `kuvat`-kansio. Gitiä tai README:tä ei vielä ole.' },
  outline: { think: '**Proposing a short README outline**', reply: 'Ehdotus:\n\n1. Mitä muistiinpanot ovat ja kenelle\n2. Tiedostojen nimeäminen (`VVVV-KK-PP.md`)\n3. Kuvat ja niihin viittaaminen\n4. Haku: `grep -ri sana *.md`' },
};
function shortScript(k) {
  const ev = []; let t = 0; const at = (d, fn) => { t += d; ev.push([t, fn]); };
  const stream = (text, id, gap) => { let acc = ''; for (const w of text.split(/(?<=\s)/)) { acc += w; const s = acc; at(gap, (S) => S.set(id, { text: s })); } };
  at(0, (S) => S.start());
  at(350, (S) => S.add({ id: 'k1', t: 'think', text: '', live: true })); stream(k.think, 'k1', 90); at(250, (S) => S.set('k1', { live: false }));
  if (k.tool) { at(300, (S) => S.add({ id: 't1', t: 'tool', ...k.tool, state: 'running', out: [], expanded: false })); k.tool.lines.forEach((l) => at(220, (S) => S.push('t1', l))); at(300, (S) => S.set('t1', { state: 'done' })); }
  at(400, (S) => S.add({ id: 'r', t: 'reply', text: '', live: true })); stream(k.reply, 'r', 40);
  at(400, (S) => S.set('r', { live: false })); at(600, (S) => S.settle());
  return ev;
}
const libScript = script;
script = () => { const s = Q.next; Q.next = null; return s ? shortScript(s) : libScript(); };
// Which reply each delivered message gets: the stopped conversation's first one plays the library turn.
const scriptFor = (n) => Q.entry === 'stopped' ? (n === 0 ? null : SHORT.readme) : (n === 0 ? SHORT.ls : SHORT.outline);

// ---------- Views ----------
const mineId = () => Q.entry === 'stopped' ? 'c1' : Q.nc;
const isMine = () => UI.sel === mineId();
const libContent = content;
content = function () {
  const c = selConv();
  if (c.id === 'c1') {
    run++;
    requestAnimationFrame(() => { following = true; stage.scrollTop = stage.scrollHeight; lastTop = stage.scrollTop; });
    return lanka('', { meta: 'top', fold: 'head', runs: 'separate' }) + '<div class="q-host"></div>';
  }
  if (c.id === Q.nc) {
    run++;
    return `<div class="vwrap"></div><div class="empty-convo q-empty"><p class="lead">Uusi keskustelu työtilassa <span class="mono">${esc(c.ws.id)}</span></p><p>Otsikko syntyy keskustelusta.</p></div><div class="q-host"></div>`;
  }
  return libContent();
};
// The top bar's state while a message waits: one word, no account of what Pi is doing.
const libChip = stateChip;
stateChip = function (c) {
  if (c.id === mineId() && Q.items.length) {
    if (Q.pi === 'failed') return `<span class="chip q-chip-err" role="status">${ICON_WARN}<span class="chip-label">Ei lähtenyt</span></span>`;
    if (Q.pi !== 'running') return `<span class="chip working" role="status"><span class="q-dot"></span><span class="chip-label">Lähetetään</span></span>`;
  }
  return libChip(c);
};

// ---------- Pending messages, per direction ----------
const failed = () => Q.pi === 'failed';
function label(it, i) {
  if (failed()) return 'Ei lähtenyt';
  if (Q.pi === 'running') return 'Lähtee, kun Pi on vastannut';
  return i === 0 ? 'Odottaa Pi:tä' : 'Jonossa edellisen jälkeen';
}
const failActions = (cls = '') => `<div class="q-fail ${cls}" role="alert"><span class="q-fail-text">${ICON_WARN}Pi ei käynnistynyt. ${Q.items.length > 1 ? 'Viestit ovat' : 'Viesti on'} tallessa.</span><span class="q-fail-acts"><button type="button" class="q-btn primary" data-q="retry">Yritä uudelleen</button><button type="button" class="q-btn" data-q="edit">Muokkaa</button></span></div>`;
function bubble1(it, i) {
  const st = failed() ? `<span class="q-st err">${ICON_WARN}Ei lähtenyt</span>` : `<span class="q-st"><span class="q-dot"></span>${label(it, i)}</span>`;
  return `<article class="bubble user q-wait${failed() ? ' q-failed' : ''}" data-qid="${it.id}"><div class="bubble-head"><span class="who">Sinä</span>${st}</div><div class="prose">${md(it.text)}</div></article>`;
}
function bubble3(it, i, last) {
  const mark = failed()
    ? `<span class="q-mark err" title="Pi ei käynnistynyt">${ICON_WARN}Ei lähtenyt</span>`
    : `<span class="q-mark" title="${label(it, i)}">${ICON_CLOCK}Jonossa</span>`;
  const acts = failed() && last ? `<div class="q-inline"><button type="button" class="q-link" data-q="retry">Yritä uudelleen</button><span aria-hidden="true">·</span><button type="button" class="q-link" data-q="edit">Muokkaa</button></div>` : '';
  return `<article class="bubble user q-tick${failed() ? ' q-failed' : ''}" data-qid="${it.id}"><div class="bubble-head"><span class="who">Sinä</span>${copyBtn('Kopioi viesti', it.text)}${mark}</div><div class="prose">${md(it.text)}</div>${acts}</article>`;
}
function queuePanel() {
  const head = failed()
    ? failActions('in-queue')
    : `<div class="q-head"><span class="q-title"><span class="q-dot"></span>${Q.pi === 'running' ? 'Lähtee, kun Pi on vastannut' : 'Odottaa Pi:tä'}</span><span class="q-n">${Q.items.length}</span></div>`;
  return `${head}<ul>${Q.items.map((it, i) => `<li data-qid="${it.id}"><span class="q-ix">${i + 1}</span><span class="q-text">${esc(it.text)}</span></li>`).join('')}</ul>`;
}
function paintPending() {
  const host = stage.querySelector('.q-host'); if (!host) return;
  if (!isMine() || Q.dir === 2) { host.innerHTML = ''; return; }
  const n = Q.items.length;
  host.innerHTML = Q.items.map((it, i) => Q.dir === 1 ? bubble1(it, i) : bubble3(it, i, i === n - 1)).join('') + (Q.dir === 1 && failed() && n ? failActions() : '');
  if (n) stage.querySelector('.q-empty')?.remove();
}

// ---------- Composer: Stop while a message waits; the queue panel in direction 2 ----------
function paintQ() {
  if (Q.was && !UI.working) turnEnded();
  Q.was = UI.working;
  const cw = comp.querySelector('.cwrap'); if (!cw) return;
  const tools = cw.querySelector('.c-tools');
  const waiting = isMine() && Q.items.length && Q.pi === 'starting';
  const ncWorking = UI.working && UI.sel === Q.nc;
  if (waiting || ncWorking) {
    tools.innerHTML = `<button class="c-stop" type="button" data-q="stop" aria-label="${waiting ? 'Pysäytä: viesti ei lähde' : 'Pysäytä Pi:n työ'}" title="${waiting ? 'Pysäytä: viesti ei lähde' : 'Pysäytä Pi:n työ'}">${ICON_STOP_Q}</button><span class="grow"></span>`;
    tools.hidden = false;
  }
  const q = cw.querySelector('.queue');
  if (Q.dir === 2 && isMine() && Q.items.length) { q.innerHTML = queuePanel(); q.hidden = false; q.classList.add('q-panel'); q.classList.toggle('q-failed', failed()); }
  else q.classList.remove('q-panel', 'q-failed');
  paintPending();
}
const libUpdate = updateComposer;
updateComposer = function () { libUpdate(); paintQ(); };
APP.painted[APP.painted.indexOf(libUpdate)] = updateComposer;

// ---------- Behaviour ----------
const ta = () => comp.querySelector('textarea');
function setField(text) { C.text = text; const t = ta(); t.value = text; fit(t); }
const libPrimary = primary;
primary = function () {
  if (!isMine() || (UI.sel === 'c1' && UI.working)) return libPrimary();
  const text = C.text.trim(); if (!text) return;
  setField(''); ta().focus(); Q.stopped = false;
  const it = { id: ++Q.id, text };
  if (Q.pi === 'running' && !UI.working && !Q.items.length) return deliver(it);
  Q.items.push(it);
  if (Q.pi === 'off' || Q.pi === 'failed') { if (Q.pi === 'failed') Q.retried = true; startPi(); }
  paint();
};
function startPi() {
  clearTimeout(Q.timer); Q.pi = 'starting';
  const fail = document.getElementById('q-fail').checked && !Q.retried;
  Q.timer = setTimeout(() => {
    if (fail) { if (Q.items.length) { Q.pi = 'failed'; paint(); } else Q.pi = 'off'; return; }
    Q.pi = 'running';
    if (Q.items.length) deliver(Q.items.shift()); else paint();
  }, ms(START_MS));
}
let delivered = 0;
function deliver(it) {
  const host = stage.querySelector('.vwrap'); if (!host || !isMine()) return;
  stage.querySelector('.q-empty')?.remove();
  stage.querySelector(`.q-host [data-qid="${it.id}"]`)?.remove();
  const time = now();
  const mark = Q.dir === 3 ? `<span class="q-mark ok">${ICON_CHECK}Pi sai viestin</span>` : `<time class="meta">${time}</time>`;
  host.insertAdjacentHTML('beforeend', `<article class="bubble user ah-in q-arrived q-arrived-${Q.dir}" data-sent="${it.id}"><div class="bubble-head"><span class="who">Sinä</span>${copyBtn('Kopioi viesti', it.text)}${mark}</div><div class="prose">${md(it.text)}</div></article>`);
  if (Q.dir === 3) setTimeout(() => { const m = host.querySelector(`[data-sent="${it.id}"] .q-mark`); if (m) m.outerHTML = `<time class="meta">${time}</time>`; }, 2600);
  const c = selConv(); const conv = c.ws.convs.find(x => x.id === c.id);
  if (conv.st === 'new') conv.st = 'working';
  following = true; stage.scrollTop = stage.scrollHeight;
  const n = delivered++; const g = Q.gen;
  paint();
  setTimeout(() => { if (g !== Q.gen) return; Q.next = scriptFor(n); currentR = threadR(); playLive(host, currentR); }, 450);
}
function turnEnded() {
  const conv = selConv(); const c = conv.ws.convs.find(x => x.id === conv.id);
  if (c.id === Q.nc) { c.st = 'waiting'; if (c.title === 'Uusi keskustelu') { c.title = 'Muistiinpanojen sisältö'; setTimeout(paint, 0); } }
  if (Q.stopped || !Q.items.length || Q.pi !== 'running') return;
  const g = Q.gen; setTimeout(() => { if (g === Q.gen && Q.items.length && !UI.working) deliver(Q.items.shift()); }, 700);
}
// Stop before Pi runs: nothing is sent, Pi is not started, and the messages return to the field.
function giveBack() {
  if (!Q.items.length) return;
  const n = Q.items.length;
  setField([...Q.items.map(i => i.text), C.text.trim()].filter(Boolean).join('\n\n'));
  Q.items = []; ta().focus();
  toast(n > 1 ? 'Viestit eivät lähteneet. Ne ovat taas kentässä.' : 'Viesti ei lähtenyt. Se on taas kentässä.');
}
function stopTurn() {
  const t = stage.querySelector('.turn.live.working'); run++;
  if (t) { const strip = t.querySelector('.strip.working'); if (strip) strip.outerHTML = `<div class="strip stopped"><span class="act">${ICON_STOP_Q}Pysäytetty</span></div>`; t.classList.remove('working'); }
}
document.addEventListener('click', (e) => {
  // The library's own Stop (Pi working in the stopped conversation) also gives back what waits.
  const lib = e.target.closest('.composer [data-c="stop"]');
  if (lib && isMine() && Q.items.length) { Q.stopped = true; giveBack(); return; }
  const b = e.target.closest('[data-q]'); if (!b) return;
  e.preventDefault();
  const a = b.dataset.q;
  if (a === 'stop') {
    Q.stopped = true;
    if (Q.pi === 'starting' && Q.items.length) { clearTimeout(Q.timer); Q.pi = 'off'; giveBack(); }
    else { giveBack(); stopTurn(); }
    return paint();
  }
  if (a === 'retry') { Q.retried = true; startPi(); return paint(); }
  if (a === 'edit') { Q.pi = 'off'; giveBack(); return paint(); }
}, true);

// ---------- Entry points and switching ----------
function reset() {
  clearTimeout(Q.timer); Q.gen++; delivered = 0;
  Object.assign(Q, { pi: 'off', items: [], stopped: false, retried: false, was: false, next: null });
  C.queue = []; if (ta()) setField('');
  const ws = UI.ws.find(w => w.id === 'muistiinpanot'); ws.convs = []; ws.open = true;
  Q.nc = null;
}
// A new conversation is created at once and opens with the field enabled; Pi becomes ready in the background.
function newConv(wsId) {
  const w = UI.ws.find(x => x.id === wsId); const id = `n${++UI.created}`;
  w.convs.unshift({ id, title: 'Uusi keskustelu', st: 'new' }); w.open = true;
  Q.nc = id; Q.entry = 'new'; UI.sel = id; startPi();
  requestAnimationFrame(() => ta()?.focus());
}
document.addEventListener('click', (e) => {
  const add = e.target.closest('[data-ws-add]'); if (!add) return;
  e.preventDefault(); e.stopImmediatePropagation();
  reset(); newConv(add.dataset.wsAdd); UI.pop = false; UI.drawer = false; paint();
  stage.innerHTML = ''; requestAnimationFrame(() => { stage.innerHTML = content(); paintQ(); });
}, true);
const libOpen = openConv;
// Switching away drops what waited (this draft follows one conversation at a time).
openConv = function (id) {
  if (id !== mineId()) { clearTimeout(Q.timer); Q.gen++; Object.assign(Q, { pi: id === Q.nc && Q.pi === 'running' ? 'running' : 'off', items: [] }); if (id === 'c1') Q.entry = 'stopped'; else if (id === Q.nc) Q.entry = 'new'; }
  libOpen(id);
};

const view = (d) => () => {
  reset(); Q.dir = d; UI.created = 0;
  if (Q.entry === 'new') newConv('muistiinpanot'); else UI.sel = 'c1';
  const html = appView(); requestAnimationFrame(paintQ); return html;
};
window.v1 = view(1); window.v2 = view(2); window.v3 = view(3);

// ---------- Page bar: entry point, failing start, and a demo that sends two messages ----------
document.getElementById('long-draft').insertAdjacentHTML('afterend', `<label>Tilanne <select id="q-entry"><option value="stopped">Pysähtynyt keskustelu</option><option value="new">Uusi keskustelu tyhjässä työtilassa</option></select></label><label><input type="checkbox" id="q-fail"> Käynnistys epäonnistuu</label><button type="button" id="q-demo" class="page-btn">Esitä</button>`);
const remount = () => document.querySelector('.proto-picker-replay')?.click();
document.getElementById('q-entry').addEventListener('change', (e) => { Q.entry = e.target.value; remount(); });
document.getElementById('q-fail').addEventListener('change', remount);
function typeAndSend(text, done) {
  const g = Q.gen; let i = 0; const t = ta(); t.focus();
  const step = () => { if (g !== Q.gen) return; i = Math.min(text.length, i + 2); setField(text.slice(0, i)); updateComposer(); if (i < text.length) setTimeout(step, 18); else setTimeout(() => { if (g === Q.gen) { primary(); done?.(); } }, 250); };
  step();
}
document.getElementById('q-demo').addEventListener('click', () => {
  remount();
  setTimeout(() => { const g = Q.gen; typeAndSend(MSG[Q.entry][0], () => setTimeout(() => { if (g === Q.gen) typeAndSend(MSG[Q.entry][1]); }, 700)); }, 500);
});
// Kept for screenshots and the check: the demo messages as data.
window.QDEMO = { Q, MSG, typeAndSend, send: (t) => { setField(t); primary(); } };
})();
