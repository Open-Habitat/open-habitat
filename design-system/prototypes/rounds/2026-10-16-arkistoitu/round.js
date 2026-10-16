// Kierros 16.10.2026: arkistoinnin jälkeinen ilmoitus. Arkistointi tehdään heti ilman
// vahvistusta ja ikkuna siirtyy työtilan näkymään (kuten tuotannossa 14.10. alkaen);
// suunnat vaihtavat vain ilmoituksen. Työtilasivu on tässä vain sijainen: sen ulkoasu
// on oma kierroksensa (proto-workspace-page).
(() => {
const N = { dir: 1, wsView: null, hl: null, el: null, conv: null, timer: 0, left: 0, since: 0 };
const LIFE = 8000;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

// ---------- Content: a settled conversation, so archiving is allowed at once ----------
if (CONVO[CONVO.length - 1].kind === 'user') CONVO.pop();
UI.ws[0].convs.push(
  { id: 'a1', title: 'Lokien kierrätys cronilla', st: 'done', archived: true, when: '2.10.' },
  { id: 'a2', title: 'Vanha deploy-skripti', st: 'done', archived: true, when: '28.9.' });
const libContent = window.content;
window.content = function () {
  if (selConv().id !== 'c1') return libContent();
  run++; document.querySelectorAll('.float-bar').forEach(el => el.remove());
  requestAnimationFrame(() => { following = true; stage.scrollTop = stage.scrollHeight; lastTop = stage.scrollTop; });
  return lanka('', { meta: 'top', fold: 'head', runs: 'separate' });
};

// ---------- Workspace view (stand-in) ----------
const wsOf = (id) => UI.ws.find(w => w.id === id);
function wsPage(w) {
  const open = w.convs.filter(c => !c.archived);
  const arch = w.convs.filter(c => c.archived).sort((a, b) => (b.at || 0) - (a.at || 0));
  const arow = (c) => `<li class="arow${c.id === N.hl ? ' hl' : ''}" data-arow="${c.id}"><a href="#" class="conv-row" data-conv="${c.id}"><span class="conv-title">${esc(c.title)}</span></a><span class="when">${c.at ? 'juuri nyt' : c.when}</span><button class="quiet-btn" type="button" data-restore="${c.id}">Palauta näkyviin</button></li>`;
  return `<div class="wsp">
<header class="wsp-head"><h1 tabindex="-1">${esc(w.id)}</h1><span class="mono sub">${esc(w.path)}</span></header>
<section aria-label="Keskustelut"><h2>Keskustelut <span class="count">${open.length}</span></h2><ul class="wsp-list">${open.map(c => `<li>${APP.row(c)}</li>`).join('')}</ul></section>
<section aria-label="Työtilan arkisto"><h2>Arkisto <span class="count">${arch.length}</span></h2><ul class="wsp-list">${arch.map(arow).join('')}</ul></section>
</div>`;
}
const libPaintTop = paintTop;
paintTop = function () {
  uiFrame.classList.toggle('ws-view', !!N.wsView);
  if (!N.wsView) return libPaintTop();
  const w = wsOf(N.wsView);
  uiTop.innerHTML = `<button class="icon-btn menu-btn" type="button" data-ui="drawer" aria-label="Avaa valikko" title="Avaa valikko">${ICON_MENU}</button><div class="tb-title"><strong>${esc(w.id)}</strong><span class="tb-ws">${esc(w.path)}</span></div>`;
};
function openWs(id, focus) {
  N.wsView = id; UI.pop = false; UI.drawer = false; run++; paint();
  stage.innerHTML = wsPage(wsOf(id)); stage.scrollTop = 0;
  if (focus) stage.querySelector('h1').focus({ preventScroll: true });
}
const repaintWs = () => { if (N.wsView) { const top = stage.scrollTop; stage.innerHTML = wsPage(wsOf(N.wsView)); stage.scrollTop = top; paintRail(); } };
const libOpenConv = openConv;
openConv = function (id) { dismiss('nav'); N.wsView = null; N.hl = null; libOpenConv(id); };
document.addEventListener('click', (e) => {
  const ws = e.target.closest('[data-ui="ws"]');
  if (ws && !ws.closest('.proto-picker')) {
    e.preventDefault(); e.stopImmediatePropagation();
    const id = ws.closest('.ws')?.querySelector('[data-ws-tog]')?.dataset.wsTog ?? selConv().ws.id;
    dismiss('nav'); N.hl = null; return openWs(id, true);
  }
  const r = e.target.closest('[data-restore]');
  if (r) {
    e.preventDefault(); e.stopImmediatePropagation();
    const c = allConvs().find(x => x.id === r.dataset.restore); const conv = c.ws.convs.find(x => x.id === c.id);
    if (N.conv === conv) dismiss('nav');
    conv.archived = false; conv.at = 0; if (N.hl === conv.id) N.hl = null; repaintWs();
  }
}, true);

// ---------- Archive: at once, then the workspace view and the notice ----------
askArchive = function () {
  const c = selConv(); if (UI.working) return;
  const conv = c.ws.convs.find(x => x.id === c.id);
  dismiss('nav'); conv.archived = true; conv.at = Date.now(); N.hl = null;
  openWs(c.ws.id, true); show(conv);
};

// ---------- The notice, per direction ----------
function show(conv) {
  N.conv = conv;
  const el = document.createElement('div'); el.setAttribute('role', 'status');
  const x = `<button class="icon-btn an-x" type="button" data-an="close" aria-label="Sulje ilmoitus" title="Sulje ilmoitus">${ICON_CLOSE}</button>`;
  if (N.dir === 2) {
    el.className = 'an an-card';
    el.innerHTML = `<span class="an-ic">${ICON_ARCHIVE}</span><div class="an-body"><strong>Keskustelu arkistoitu</strong><p><b>${esc(conv.title)}</b> on nyt työtilan Arkisto-osiossa. Pi:n historia säilyy.</p><div class="an-actions"><button class="secondary" type="button" data-an="restore">Palauta</button></div></div>${x}`;
  } else {
    el.className = 'an an-snack';
    el.innerHTML = `<span class="an-text">Arkistoitu <b>${esc(conv.title)}</b></span><button class="an-act" type="button" data-an="restore">Palauta</button>${x}`;
  }
  uiMain.appendChild(el); N.el = el;
  if (N.dir !== 2) {
    // The time pauses while the pointer or focus is on the notice.
    N.left = LIFE; run1();
    // A removed notice can still get focusout; only the current one may restart the time.
    const mine = () => N.el === el;
    el.addEventListener('pointerenter', () => { if (mine()) pause(); }); el.addEventListener('focusin', () => { if (mine()) pause(); });
    el.addEventListener('pointerleave', () => { if (mine() && !el.contains(document.activeElement)) run1(); });
    el.addEventListener('focusout', (e) => { if (mine() && !el.contains(e.relatedTarget) && !el.matches(':hover')) run1(); });
  }
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); dismiss('close'); } });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-an]'); if (!b) return;
    if (b.dataset.an === 'close') return dismiss('close');
    restore(b);
  });
}
function run1() { clearTimeout(N.timer); N.since = performance.now(); N.timer = setTimeout(() => dismiss('timeout'), N.left); }
function pause() { if (!N.since) return; clearTimeout(N.timer); N.left = Math.max(1500, N.left - (performance.now() - N.since)); N.since = 0; }
function restore(b) {
  const conv = N.conv; if (b.getAttribute('aria-busy')) return;
  pause(); b.setAttribute('aria-busy', 'true'); b.textContent = 'Palautetaan…';
  setTimeout(() => { if (N.conv !== conv) return; conv.archived = false; conv.at = 0; dismiss('nav'); openConv(conv.id); }, 500);
}
// Exit animations keep the notice's own centring transform.
const base = (el) => { const t = getComputedStyle(el).transform; return t === 'none' ? '' : t; };
function dismiss(why) {
  const el = N.el; if (!el) return;
  clearTimeout(N.timer); N.el = null; N.since = 0;
  const conv = N.conv; N.conv = null;
  const row = N.wsView && stage.querySelector(`[data-arow="${conv.id}"]`);
  if (N.dir === 3 && why !== 'nav' && row) {
    // The notice hands over to the archive row, which stays marked while the page is open.
    N.hl = conv.id; row.scrollIntoView({ block: 'nearest', behavior: reduced.matches ? 'auto' : 'smooth' });
    if (reduced.matches) { el.remove(); row.classList.add('hl'); return; }
    setTimeout(() => {
      const a = el.getBoundingClientRect(), r = row.getBoundingClientRect();
      const dx = (r.left + r.width / 2) - (a.left + a.width / 2), dy = (r.top + r.height / 2) - (a.top + a.height / 2);
      el.animate([{ transform: base(el), opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) ${base(el)} scale(.55)`, opacity: 0 }], { duration: 420, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' })
        .finished.then(() => { el.remove(); row.classList.add('hl'); });
    }, reduced.matches ? 0 : 200);
    return;
  }
  if (reduced.matches || why === 'nav') return el.remove();
  el.animate([{ opacity: 1, transform: base(el) }, { opacity: 0, transform: `${N.dir === 2 ? 'translateY(-6px)' : 'translateY(8px)'} ${base(el)}` }], { duration: 160, easing: 'ease-in', fill: 'forwards' }).finished.then(() => el.remove());
}

const view = (d) => () => { dismiss('nav'); N.dir = d; N.wsView = null; N.hl = null; for (const c of allConvs()) if (c.at) { c.ws.convs.find(x => x.id === c.id).archived = false; c.ws.convs.find(x => x.id === c.id).at = 0; } UI.sel = 'c1'; return appView(); };
window.v1 = view(1); window.v2 = view(2); window.v3 = view(3);
})();
