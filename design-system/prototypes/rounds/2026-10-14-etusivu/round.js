// Kierros 14.10.2026: etusivu. Sivupalkin Etusivu-rivi palaa tähän näkymään;
// keskustelurivi avaa kirjaston keskustelun. Kaikissa suunnissa voi aloittaa
// uuden keskustelun ja luoda uuden työtilan (Jari 14.10.).
(() => {
const ICON_FOLDER = SVG('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>');
const ICON_GH = SVG('<path d="M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>');
const ICON_SEND = SVG('<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>');
const ICON_DOWN = SVG('<path d="m6 9 6 6 6-6"/>');
const ICON_FWD = SVG('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>');

// Sisältö: viimeisin agentin rivi tai meneillään oleva työ, ja aika.
const INFO = {
  c2: { t: '8 min', say: 'Pakkaus valmis: 214 kuvaa, 38 Mt → 11 Mt. Poistanko alkuperäiset, vai jätetäänkö ne <span class="mono">originals/</span>-hakemistoon?' },
  c10: { t: '25 min', say: 'Kumpi muoto: <span class="mono">-label:bug</span> vai <span class="mono">NOT label:bug</span>? Ensimmäinen on lyhyempi, jälkimmäinen sama kuin GitHubissa.' },
  c1: { t: '1 min', say: 'Skripti tulostaa nyt viime viikon statusrivit. Lisätäänkö JSON-tuloste samaan ajoon?' },
  c5: { t: 'nyt', doing: 'ajaa <span class="mono">npm test</span>', dur: '2 min' },
  c4: { t: '3 t', say: 'Prosessin tilaa ei saatu luettua.' },
  c3: { t: '2 t' }, c7: { t: 'eilen' }, c8: { t: 'ma' }, c11: { t: '11.10.' }, c6: { t: 'ma' },
};
const GH = ['maintainer/reitti', 'maintainer/kuitit', 'maintainer/wilma-cli', 'jarimustonen/taskfleet'];
let HOME = true, CUR = 'v1', MENU = false, NWS = 'gh';
const stOf = (c) => convState(c);
const info = (c) => INFO[c.id] || {};
const live = () => allConvs().filter(c => !c.archived);
const needs = () => live().filter(c => ['attention', 'waiting'].includes(stOf(c))).sort((a, b) => (stOf(a) === 'attention' ? 0 : 1) - (stOf(b) === 'attention' ? 0 : 1));
const working = () => live().filter(c => stOf(c) === 'working');
const recent = () => live().filter(c => ['done', 'unknown'].includes(stOf(c)));
const mark = (c) => { const [l, m] = STATES[stOf(c)] ?? ['Ei aloitettu', '<span class="st-none"></span>']; return `<span class="st" role="img" aria-label="${l}" title="${l}">${m}</span>`; };
const stLabel = (c) => (STATES[stOf(c)] ?? ['Ei aloitettu'])[0];

// ---------- Shared actions ----------
const wsMenu = () => `<div class="h-menu" role="menu">${UI.ws.map(w => `<button type="button" role="menuitem" data-h-new="${w.id}">${ICON_FOLDER}<span class="mono">${esc(w.id)}</span></button>`).join('')}<hr><button type="button" role="menuitem" data-h-nws>${ICON_PLUS}<span>Uusi työtila…</span></button></div>`;
const newBtn = () => `<span class="h-anchor"><button type="button" class="h-primary" data-h-menu aria-expanded="${MENU}" aria-haspopup="menu">${ICON_PLUS}<span>Uusi keskustelu</span>${ICON_DOWN}</button>${MENU ? wsMenu() : ''}</span>`;
const nwsBtn = (cls = 'h-secondary') => `<button type="button" class="${cls}" data-h-nws>${ICON_FOLDER}<span>Uusi työtila</span></button>`;

function newConv(wsId, title, st) {
  const w = UI.ws.find(x => x.id === wsId); const id = `n${++UI.created}`;
  w.convs.unshift({ id, title: title || 'Uusi keskustelu', st: st || 'new' }); w.open = true;
  if (title) INFO[id] = { t: 'nyt', doing: 'lukee tehtävää', dur: '0 s' };
  HOME = false; MENU = false; openConv(id);
}
const dlg = document.createElement('dialog'); dlg.className = 'confirm nws'; document.body.appendChild(dlg);
function paintDlg() {
  const gh = NWS === 'gh';
  dlg.innerHTML = `<form method="dialog"><h3>Uusi työtila</h3>
<div class="seg" role="tablist"><button type="button" role="tab" aria-selected="${gh}" data-nws="gh">${ICON_GH}Kloonaa GitHubista</button><button type="button" role="tab" aria-selected="${!gh}" data-nws="dir">${ICON_FOLDER}Uusi hakemisto</button></div>
${gh ? `<label class="fld"><span>Repositorio</span><input name="v" class="mono" placeholder="omistaja/repo" autocomplete="off" required></label>
<ul class="sugg">${GH.map(r => `<li><button type="button" data-sugg="${r}" class="mono">${r}</button></li>`).join('')}</ul>
<p class="hint">Kloonataan hakemistoon <span class="mono">~/src/&lt;repo&gt;</span> sinun GitHub-tunnuksillasi.</p>`
    : `<label class="fld"><span>Nimi</span><input name="v" class="mono" placeholder="uusi-projekti" autocomplete="off" required pattern="[a-z0-9._-]+"></label>
<p class="hint">Luodaan <span class="mono">~/src/&lt;nimi&gt;</span> ja alustetaan Git-repoksi.</p>`}
<div class="confirm-actions"><button class="secondary" value="cancel" formnovalidate>Peruuta</button><button class="primary" value="ok">Luo työtila</button></div></form>`;
}
function openDlg() { MENU = false; paintDlg(); dlg.showModal(); dlg.querySelector('input').focus(); }
dlg.addEventListener('click', (e) => {
  const t = e.target.closest('[data-nws], [data-sugg]'); if (!t) return;
  if (t.dataset.nws) { NWS = t.dataset.nws; paintDlg(); dlg.querySelector('input').focus(); }
  else { dlg.querySelector('input').value = t.dataset.sugg; }
});
dlg.addEventListener('close', () => {
  if (dlg.returnValue !== 'ok') return;
  const v = dlg.querySelector('input').value.trim(); const id = v.split('/').pop();
  if (!id || UI.ws.some(w => w.id === id)) return toast(`Työtila ${id} on jo olemassa.`);
  UI.ws.push({ id, path: `~/src/${id}`, open: true, convs: [] });
  paint(); rerender(); toast(NWS === 'gh' ? `Kloonattu ${v} → ~/src/${id}` : `Työtila ${id} luotu`);
});

// ---------- Home state across the library frame ----------
function rerender() { if (HOME) { stage.innerHTML = window[CUR](true); } }
APP.painted.push(() => {
  uiFrame.classList.toggle('is-home', HOME);
  uiRail.querySelector('.home-row').toggleAttribute('aria-current', HOME);
  if (HOME) {
    uiRail.querySelectorAll('.conv-row[aria-current]').forEach(a => a.removeAttribute('aria-current'));
    uiTop.innerHTML = `<button class="icon-btn menu-btn" type="button" data-ui="drawer" aria-label="Avaa valikko" title="Avaa valikko">${ICON_MENU}</button><div class="tb-title"><strong>Etusivu</strong></div>`;
  }
});
document.addEventListener('click', (e) => {
  if (e.target.closest('.proto-picker')) return;
  const home = e.target.closest('[data-ui="home"]');
  if (home) { e.preventDefault(); e.stopPropagation(); HOME = true; UI.drawer = false; MENU = false; paint(); stage.innerHTML = window[CUR](true); return; }
  if (e.target.closest('[data-conv], [data-ws-add]')) { HOME = false; MENU = false; return; }
  const t = e.target.closest('[data-h-menu], [data-h-new], [data-h-nws], [data-h-ws]');
  if (!t) { if (MENU && !e.target.closest('.h-menu')) { MENU = false; rerender(); } return; }
  e.preventDefault(); e.stopPropagation();
  if (t.dataset.hMenu !== undefined) { MENU = !MENU; return rerender(); }
  if (t.dataset.hNew) return newConv(t.dataset.hNew);
  if (t.dataset.hNws !== undefined) return openDlg();
  if (t.dataset.hWs) return toast('Työtilasivu on oma kierroksensa.');
}, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && MENU) { MENU = false; rerender(); } });

// ---------- V1 · Huomiolista ----------
function needCard(c) {
  const i = info(c); const s = stOf(c);
  return `<li><a href="#" class="need ${s}" data-conv="${c.id}"><span class="need-head">${mark(c)}<span class="need-title">${esc(c.title)}</span><span class="need-ws mono">${esc(c.ws.id)}</span><time>${i.t || ''}</time></span>${i.say ? `<span class="need-say">${i.say}</span>` : ''}<span class="need-go">${s === 'attention' ? 'Lue vastaus' : 'Vastaa'}${ICON_FWD}</span></a></li>`;
}
function line(c, extra = '') {
  const i = info(c);
  return `<li><a href="#" class="hrow" data-conv="${c.id}">${mark(c)}<span class="hrow-title">${esc(c.title)}</span>${extra}<span class="hrow-ws mono">${esc(c.ws.id)}</span><time>${i.t || ''}</time></a></li>`;
}
const doing = (c) => { const i = info(c); return i.doing ? `<span class="hrow-doing">${i.doing} · ${i.dur}</span>` : ''; };
function v1Body() {
  const n = needs(), w = working(), r = recent();
  return `<div class="home v1">
<header class="h-head"><h1>Etusivu</h1><div class="h-acts">${nwsBtn()}${newBtn()}</div></header>
<section aria-labelledby="h-need"><h2 id="h-need">Odottaa sinua <span class="count">${n.length}</span></h2>${n.length ? `<ul class="needs">${n.map(needCard).join('')}</ul>` : '<p class="h-empty">Mikään keskustelu ei odota sinua.</p>'}</section>
${w.length ? `<section aria-labelledby="h-work"><h2 id="h-work">Käynnissä</h2><ul class="hrows">${w.map(c => line(c, doing(c))).join('')}</ul></section>` : ''}
<section aria-labelledby="h-rec"><h2 id="h-rec">Viimeksi</h2><ul class="hrows">${r.map(c => line(c)).join('')}</ul></section>
</div>`;
}

// ---------- V2 · Työtilat ----------
function wsCard(w) {
  const cs = w.convs.filter(c => !c.archived);
  const act = cs.filter(c => stOf(c) !== 'done').sort((a, b) => (STATE_ORDER[stOf(a)] ?? 4) - (STATE_ORDER[stOf(b)] ?? 4));
  const done = cs.length - act.length;
  const cnt = (s, l) => { const k = cs.filter(c => stOf(c) === s).length; return k ? `<span class="pill ${s}">${STATES[s][1]}${k} ${l}</span>` : ''; };
  return `<article class="wscard">
<header><a href="#" class="wscard-name mono" data-h-ws="${w.id}">${esc(w.id)}</a><button type="button" class="icon-btn" data-h-new="${w.id}" aria-label="Uusi keskustelu työtilassa ${w.id}" title="Uusi keskustelu">${ICON_PLUS}</button></header>
<p class="wscard-path mono">${esc(w.path)}</p>
<div class="pills">${cnt('attention', 'uusi')}${cnt('waiting', 'odottaa')}${cnt('working', 'käynnissä')}</div>
${act.length ? `<ul class="wscard-list">${act.slice(0, 3).map(c => `<li><a href="#" data-conv="${c.id}">${mark(c)}<span>${esc(c.title)}</span></a></li>`).join('')}</ul>` : `<p class="wscard-quiet">${cs.length ? 'Ei avointa työtä.' : 'Ei vielä keskusteluja.'}</p>`}
<footer>${done ? `${done} valmis${done > 1 ? 'ta' : ''}` : ''}${act.length > 3 ? ` · ${act.length - 3} muuta avointa` : ''}</footer>
</article>`;
}
function v2Body() {
  const n = needs();
  return `<div class="home v2">
<header class="h-head"><h1>Työtilat</h1><div class="h-acts">${nwsBtn('h-primary')}</div></header>
${n.length ? `<div class="strip" role="region" aria-label="Odottaa sinua"><span class="strip-lbl">Odottaa sinua</span>${n.map(c => `<a href="#" class="strip-chip" data-conv="${c.id}">${mark(c)}<span>${esc(c.title)}</span></a>`).join('')}</div>` : ''}
<div class="wsgrid">${UI.ws.map(wsCard).join('')}<button type="button" class="wscard add" data-h-nws>${ICON_PLUS}<span>Uusi työtila</span><small>Kloonaa GitHubista tai luo hakemisto</small></button></div>
</div>`;
}

// ---------- V3 · Aloita työ ----------
let PICK = null;
function v3Body() {
  PICK = PICK && UI.ws.some(w => w.id === PICK) ? PICK : 'aurinkokello';
  const n = needs(), w = working(), r = recent().slice(0, 4);
  return `<div class="home v3">
<form class="start" data-start>
<h1>Mitä tehdään?</h1>
<div class="start-box"><textarea rows="2" placeholder="Kerro Pi:lle tehtävä…" aria-label="Uuden keskustelun ensimmäinen viesti"></textarea>
<div class="start-row"><label class="ws-pick">${ICON_FOLDER}<select aria-label="Työtila">${UI.ws.map(x => `<option${x.id === PICK ? ' selected' : ''}>${x.id}</option>`).join('')}<option value="__new">Uusi työtila…</option></select>${ICON_DOWN}</label>
<button type="submit" class="send" aria-label="Aloita keskustelu" title="Aloita keskustelu">${ICON_SEND}</button></div></div>
</form>
${n.length ? `<section aria-labelledby="h3-need"><h2 id="h3-need">Odottaa sinua</h2><div class="cards">${n.map(c => `<a href="#" class="card ${stOf(c)}" data-conv="${c.id}"><span class="card-head">${mark(c)}<span class="mono">${esc(c.ws.id)}</span><time>${info(c).t || ''}</time></span><strong>${esc(c.title)}</strong><span class="card-say">${info(c).say || ''}</span></a>`).join('')}</div></section>` : ''}
<section aria-labelledby="h3-rec"><h2 id="h3-rec">Jatka</h2><ul class="hrows">${[...w, ...r].map(c => line(c, doing(c))).join('')}</ul></section>
</div>`;
}
document.addEventListener('change', (e) => {
  const s = e.target.closest('.ws-pick select'); if (!s) return;
  if (s.value === '__new') { s.value = PICK; openDlg(); } else PICK = s.value;
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-start]'); if (!f) return;
  e.preventDefault(); const ta = f.querySelector('textarea'); const text = ta.value.trim();
  if (!text) { ta.focus(); return; }
  const title = text.length > 48 ? text.slice(0, 46).trimEnd() + '…' : text;
  newConv(PICK, title, 'working');
});
document.addEventListener('keydown', (e) => {
  const ta = e.target.closest?.('.start textarea'); if (!ta || e.key !== 'Enter' || e.shiftKey) return;
  e.preventDefault(); ta.form.requestSubmit();
});
document.addEventListener('input', (e) => {
  const ta = e.target.closest?.('.start textarea'); if (!ta) return;
  ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 220) + 'px';
});

const show = (v) => (keep) => { CUR = v; HOME = true; if (!keep) MENU = false; UI.sel = 'c1'; UI.pop = false; paint(); return { v1: v1Body, v2: v2Body, v3: v3Body }[v](); };
window.v1 = show('v1'); window.v2 = show('v2'); window.v3 = show('v3');
})();
