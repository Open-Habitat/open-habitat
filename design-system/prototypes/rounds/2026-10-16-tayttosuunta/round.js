// Kierros 16.10.2026: uuden keskustelun täyttösuunta (issue proto-composer-strip, aihe 1).
// Sama tarina kaikissa suunnissa: tyhjä keskustelu, ensimmäinen viesti lähtee itsestään,
// Pi työskentelee (ajattelu, testiajo, muokkaus, toinen testiajo), kirjoittaa pitkän
// vastauksen, keskustelu saa otsikon ja hetken päästä kentän yllä näkyy tilannekatsaus.
// Kirjaston elävä vuoro, hiljainen työ, kenttä ja katsaus ovat sellaisinaan; kierros
// vaihtaa vain sen, missä lanka istuu ja miten näkymä seuraa lähetettyä viestiä.
(() => {
const ICON_DOWN = SVG('<path d="M12 5v14"/><path d="m6 13 6 6 6-6"/>');
const FIRST = 'Testit kaatuvat `scripts/status_rows.py`:ssä. Korjaa ne ja kerro sitten, miten skripti valitsee rivit.';
const FOLLOW = 'Lisää `--today` README:n esimerkkeihin ja kerro yhdellä lauseella, mihin sitä tarvitaan.';
const TITLE = 'Status-skriptin testit';
// The first reply is long on purpose: the short fix, then the whole "how rows are chosen".
LIVE.reply = `${LIVE.reply}\n\n${RICH}`;

// ---------- The follow-up turn: a short look, one edit, a short reply ----------
const FOLLOW_LIVE = {
  think: 'README:n esimerkit ovat Käyttö-otsikon alla. Lisään `--today`-rivin `--since`-esimerkin jälkeen.',
  grep: { name: 'bash', target: 'grep -n -- "--since" README.md', args: { command: 'grep -n -- "--since" README.md' }, lines: ['24:python3 scripts/status_rows.py --since 2026-10-06', '31:`--since` antaa alarajan käsin; oletus on seitsemän päivää taaksepäin.'] },
  edit: { name: 'bash', target: "sed -i '31a …' README.md", args: { command: "sed -i '31a\\\\\\n```\\npython3 scripts/status_rows.py --today 2026-10-13\\n```\\n`--today` kiinnittää kuluvan päivän.' README.md && git diff --stat" }, lines: [' README.md | 4 ++++', ' 1 file changed, 4 insertions(+)'] },
  reply: 'Lisäsin README:hen esimerkin:\n\n```\npython3 scripts/status_rows.py --today 2026-10-13\n```\n\n`--today` kiinnittää kuluvan päivän, joten tulos on sama joka ajolla: testit ja vanhojen viikkojen tarkastelu eivät riipu koneen kellosta.',
};
function followScript() {
  const ev = []; let t = 0; const at = (d, fn) => { t += d; ev.push([t, fn]); };
  const stream = (text, id, gap) => { let acc = ''; for (const w of text.split(/(?<=\s)/)) { acc += w; const s = acc; at(gap, (S) => S.set(id, { text: s })); } };
  at(0, (S) => S.start());
  at(350, (S) => S.add({ id: 'f1', t: 'think', text: '', live: true }));
  stream(FOLLOW_LIVE.think, 'f1', 60);
  at(250, (S) => S.set('f1', { live: false }));
  at(300, (S) => S.add({ id: 'f2', t: 'tool', ...FOLLOW_LIVE.grep, state: 'forming', out: [], expanded: true }));
  at(500, (S) => S.set('f2', { state: 'running' }));
  FOLLOW_LIVE.grep.lines.forEach((l) => at(250, (S) => S.push('f2', l)));
  at(250, (S) => S.set('f2', { state: 'done' }));
  at(400, (S) => S.add({ id: 'f3', t: 'tool', ...FOLLOW_LIVE.edit, state: 'forming', out: [], expanded: true }));
  at(600, (S) => S.set('f3', { state: 'running' }));
  FOLLOW_LIVE.edit.lines.forEach((l) => at(300, (S) => S.push('f3', l)));
  at(250, (S) => S.set('f3', { state: 'done' }));
  at(500, (S) => S.add({ id: 'fr', t: 'reply', text: '', live: true }));
  stream(FOLLOW_LIVE.reply, 'fr', 45);
  at(400, (S) => S.set('fr', { live: false }));
  at(700, (S) => S.settle());
  return ev;
}

// ---------- Round state ----------
const F = { v: 'v1', token: 0, sent: 0, titled: false, wasWorking: false, exch: null };
const c1 = () => UI.ws.find(w => w.id === 'aurinkokello').convs.find(c => c.id === 'c1');
const now = () => new Date().toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');

// The live-turn renderer the frame would use now (hidden work by default, the account
// menu's "Agentin työ" honoured): ask the library's content() and keep its R.
function liveR() {
  const lib = withLive; let R = null;
  withLive = (cls, r) => { R = r; return ''; };
  try { content(); } finally { withLive = lib; }
  // "Työ näkyvissä" in the page bar: the thread open from the start, as the account menu's
  // "Agentin työ: Näkyvissä" would give it, so the tool work is seen filling the view.
  if (document.getElementById('fill-work')?.checked) { R = threadR(); R.startOpen = true; }
  currentR = R; return R;
}

// ---------- Sending: where the new message goes and how the view follows ----------
// The column's free height inside the stage: the "view" a sent message starts in V3.
const exTop = (ex) => stage.scrollTop + ex.getBoundingClientRect().top - stage.getBoundingClientRect().top - parseFloat(getComputedStyle(stage).paddingTop);
const reserve = () => { if (F.exch?.isConnected) F.exch.style.minHeight = viewH() + 'px'; };
new ResizeObserver(reserve).observe(stage);
// The reader's own scrolling, as the library's stage tells it (wheel, touch, keys).
let readerAt = -Infinity;
for (const ev of ['wheel', 'touchmove', 'keydown']) stage.addEventListener(ev, () => { readerAt = performance.now(); }, { passive: true });
const readerSince = (t) => readerAt > t;
const viewH = () => { const cs = getComputedStyle(stage); return stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom); };
function sendHere(text) {
  const host = stage.querySelector('.vwrap.fill'); if (!host) return;
  host.querySelector('.fill-empty')?.remove();
  const R = liveR(); const lib = script;
  if (F.sent > 0) script = followScript;
  F.sent++;
  const bubble = userBubble({ md: text, time: now() }, 0);
  try {
    if (F.v === 'v3') {
      // The previous exchange gives its reserved height back; the new one starts a view.
      for (const x of host.querySelectorAll('.exch')) x.style.minHeight = '';
      F.exch = null;
      const ex = document.createElement('div'); ex.className = 'exch'; ex.innerHTML = bubble; host.appendChild(ex);
      following = false;
      playLive(ex, R);
      // The field grows its working row and the recap may appear, so the view's height
      // changes after sending: the reserve follows it, and the message is brought to the
      // top once more when the rise has ended, unless the reader has scrolled meanwhile.
      F.exch = ex; reserve();
      const tk = F.token; const at = performance.now();
      requestAnimationFrame(() => { reserve(); stage.scrollTo({ top: exTop(ex), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); });
      setTimeout(() => { if (tk === F.token && F.exch === ex && !readerSince(at)) { reserve(); following = false; stage.scrollTop = exTop(ex); lastTop = stage.scrollTop; } }, 700);
    } else {
      host.insertAdjacentHTML('beforeend', bubble);
      following = true; stage.scrollTop = stage.scrollHeight; lastTop = stage.scrollTop;
      playLive(host, R);
    }
  } finally { script = lib; }
}
// The library's composer sends into the history thread; at rest, this round's send takes over.
comp.addEventListener('click', (e) => {
  const b = e.target.closest('[data-c="send"]'); if (!b || working() || !stage.querySelector('.vwrap.fill')) return;
  e.stopPropagation(); e.preventDefault(); fromField();
}, true);
comp.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing || working() || !stage.querySelector('.vwrap.fill')) return;
  e.stopPropagation(); e.preventDefault(); fromField();
}, true);
function fromField() {
  const text = C.text.trim(); if (!text) return;
  C.text = ''; const ta = comp.querySelector('textarea'); ta.value = ''; fit(ta);
  sendHere(text); updateComposer();
}

// ---------- After the first turn: the title, then the recap ----------
APP.painted.push(() => {
  if (!stage.querySelector('.vwrap.fill')) return;
  const w = UI.working;
  if (F.wasWorking && !w && !F.titled) {
    F.titled = true; const tk = F.token;
    setTimeout(() => { if (tk !== F.token) return; c1().title = TITLE; paint(); }, 600);
    // The recap normally comes after three idle minutes; here after a short pause.
    setTimeout(() => { if (tk !== F.token || UI.working) return; generate(true); }, 2600);
  }
  F.wasWorking = w;
});

// ---------- Viimeisimpään: a plain round arrow, the same in every direction ----------
const jump = document.createElement('div'); jump.className = 'fill-jump-host';
jump.innerHTML = `<button type="button" class="fill-jump" aria-label="Viimeisimpään" title="Viimeisimpään" hidden>${ICON_DOWN}</button>`;
stage.after(jump);
const jumpBtn = jump.firstElementChild;
const syncJump = () => { const gap = stage.scrollHeight - stage.scrollTop - stage.clientHeight; jumpBtn.hidden = !stage.querySelector('.vwrap.fill') || gap < 60; };
stage.addEventListener('scroll', syncJump, { passive: true });
new MutationObserver(syncJump).observe(stage, { subtree: true, childList: true, characterData: true });
jumpBtn.addEventListener('click', () => { following = true; stage.scrollTo({ top: stage.scrollHeight, behavior: 'smooth' }); });

// ---------- Page bar: the follow-up message ----------
document.querySelector('.page-bar .hint').insertAdjacentHTML('beforebegin', '<label title="Agentin työ näkyvissä alusta asti; vaihto soittaa tarinan uudelleen"><input type="checkbox" id="fill-work"> Työ näkyvissä</label>');
document.getElementById('fill-work').addEventListener('change', () => document.querySelector('.proto-picker-replay')?.click());
document.querySelector('.page-bar .hint').insertAdjacentHTML('beforebegin', '<button type="button" id="fill-follow" class="page-btn" title="Lähettää toisen viestin, kun Pi on valmis">Jatkoviesti</button>');
document.getElementById('fill-follow').addEventListener('click', () => {
  if (!stage.querySelector('.vwrap.fill')) return;
  if (UI.working) return toast('Pi työskentelee vielä; jatkoviesti lähtee, kun vuoro on päättynyt.');
  sendHere(FOLLOW);
});

// ---------- Directions ----------
const EMPTY = `<div class="fill-empty"><p class="lead">Uusi keskustelu työtilassa <span class="mono">aurinkokello</span></p><p>Pi käynnistyy, kun lähetät ensimmäisen viestin. Otsikko syntyy keskustelusta.</p></div>`;
function fresh(v) {
  run++; const tk = ++F.token;
  Object.assign(F, { v, sent: 0, titled: false, wasWorking: false, exch: null });
  UI.sel = 'c1'; c1().title = 'Uusi keskustelu';
  // No recap until the conversation has something to recap.
  K.ix = 0; K.at = Date.now(); K.dismissed = K.at; K.stale = false; K.pending = false;
  C.text = ''; C.queue = [];
  following = true;
  UI.pop = false; paint();
  const html = `<div class="vwrap fill fill-${v}">${EMPTY}</div>`;
  const ta = comp.querySelector('textarea'); ta.value = ''; fit(ta);
  // The first message goes out by itself so every direction plays the same story.
  setTimeout(() => { if (tk === F.token) { ta.value = FIRST; C.text = FIRST; fit(ta); updateComposer(); } }, 300);
  setTimeout(() => { if (tk === F.token) fromField(); }, 1300);
  return html;
}
window.v1 = () => fresh('v1');
window.v2 = () => fresh('v2');
window.v3 = () => fresh('v3');
})();
