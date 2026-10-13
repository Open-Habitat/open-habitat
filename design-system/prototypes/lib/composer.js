// Keskustelun alakerta: kenttä ja sen toiminnot (Jari 13.10.2026, kierrokset
// rounds/2026-10-13-alakerta, -tyokalurivi ja -sivulahetys, suunta Kentän alla).
// Levossa yksirivinen kenttä ja sen vieressä Lähetä-ikoni; kenttä kasvaa noin 12
// riviin ja vierittyy sitten. Pi:n työn ajan kentän alla on rivi: Stop vasemmalla
// ja Ohjaa / Työn jälkeen -pilleri oikealla; Lähetä tekee valitun. Stop pysäyttää
// heti ilman vahvistusta. Jono on tiivis lista kentän yllä. Pikanäppäinohjetta ei
// ole. Mukana, kun kierros vie `app = true` eikä `composer = false`.

const ICON_SEND = SVG('<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>', ' stroke-width="2.2"');
const ICON_STOP = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/></svg>';
const ICON_STEER = SVG('<path d="M5 4v6a4 4 0 0 0 4 4h10"/><path d="m15 10 4 4-4 4"/>');
const ICON_QUEUE = SVG('<path d="M4 6h12M4 12h9M4 18h6"/><path d="M18 13v7M14.5 16.5h7"/>');
const LABELS = {
  steer: ['Ohjaa', 'Ohjaa: Pi saa viestin työn välivaiheessa'],
  follow: ['Työn jälkeen', 'Työn jälkeen: viesti lähtee, kun vuoro päättyy'],
};

const C = { text: '', mode: 'steer', queue: [], qid: 0, was: false, t0: 0, stopped: false };
const comp = document.querySelector('.composer');
const working = () => UI.working && selConv().id === 'c1';
const clock = () => { const s = Math.max(0, Math.round((performance.now() - C.t0) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const now = () => new Date().toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');

// ---------- Pieces ----------
const sendBtn = (label = 'Lähetä', tip = label) => `<button class="c-send" type="button" data-c="send" aria-label="${label}" title="${tip}"${C.text.trim() ? '' : ' aria-disabled="true"'}>${ICON_SEND}</button>`;
const stopBtn = () => `<button class="c-stop" type="button" data-c="stop" aria-label="Pysäytä Pi:n työ" title="Pysäytä Pi:n työ">${ICON_STOP}</button>`;
const seg = () => `<div class="c-seg" role="group" aria-label="Viestin tapa työn aikana">${['steer', 'follow'].map(k => `<button type="button" data-c="mode" data-mode="${k}" aria-pressed="${C.mode === k}" title="${LABELS[k][1]}">${k === 'steer' ? ICON_STEER : ICON_QUEUE}<span>${LABELS[k][0]}</span></button>`).join('')}</div>`;
function queueHtml() {
  if (!C.queue.length) return '';
  return `<div class="q-head"><span>Jonossa ${C.queue.length}</span><button type="button" class="q-clear" data-c="clear">Tyhjennä jono</button></div><ul>${C.queue.map(q => `<li><span class="q-kind ${q.kind}">${q.kind === 'steer' ? ICON_STEER + 'Ohjaus' : ICON_QUEUE + 'Työn jälkeen'}</span><span class="q-text">${esc(q.text)}</span></li>`).join('')}</ul>`;
}

// ---------- Build per direction, update on every state change ----------
function buildComposer() {
  comp.className = 'composer';
  comp.innerHTML = `<div class="cwrap">
<div class="queue" aria-label="Jono"></div>
<div class="cbox"><textarea rows="1" aria-label="Viesti Pi:lle"></textarea></div>
<div class="c-side"></div>
<div class="c-tools"></div>
</div>`;
  const ta = comp.querySelector('textarea');
  ta.value = C.text; fit(ta);
  ta.addEventListener('input', () => { C.text = ta.value; fit(ta); updateComposer(); });
  ta.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    e.preventDefault(); primary();
  });
}
// One line at rest; grows with the text up to the CSS max-height, then scrolls.
function fit(ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; }
function updateComposer() {
  if (!comp.querySelector('.cwrap')) return;
  const w = working(); const has = !!C.text.trim();
  if (w && !C.was) { C.t0 = performance.now(); C.stopped = false; }
  if (!w && C.was) turnEnded();
  C.was = w;
  const ta = comp.querySelector('textarea');
  ta.placeholder = w ? 'Ohjaa Pi:tä tai lisää jonoon…' : 'Kirjoita Pi:lle…';
  const q = comp.querySelector('.queue'); q.innerHTML = queueHtml(); q.hidden = !C.queue.length;
  const tools = comp.querySelector('.c-tools');
  tools.innerHTML = w ? `${stopBtn()}<span class="grow"></span>${seg()}` : '';
  tools.hidden = !w;
  comp.querySelector('.c-side').innerHTML = `${sendBtn(w ? LABELS[C.mode][0] : 'Lähetä', w ? LABELS[C.mode][1] : 'Lähetä')}`;
}
APP.painted.push(updateComposer);

// ---------- Actions ----------
function primary() { if (!working()) return send('now'); send(C.mode); }
function send(kind) {
  const text = C.text.trim(); if (!text) return;
  if (kind === 'now') {
    if (selConv().id !== 'c1') return toast('Tässä vedoksessa viestin voi lähettää Status-skriptiin.');
    const host = stage.querySelector('.vwrap'); if (!host) return;
    host.insertAdjacentHTML('beforeend', userBubble({ md: text, time: now() }, 0));
    following = true; stage.scrollTop = stage.scrollHeight; playLive(host, currentR);
  } else {
    const item = { id: ++C.qid, kind, text }; C.queue.push(item);
    if (kind === 'steer') setTimeout(() => { if (!C.queue.includes(item) || !working()) return; C.queue = C.queue.filter(x => x !== item); toast('Ohjaus toimitettiin Pi:lle työn välivaiheessa.'); updateComposer(); }, 2600);
  }
  C.text = ''; const ta = comp.querySelector('textarea'); ta.value = ''; fit(ta); ta.focus(); updateComposer();
}
function turnEnded() {
  if (C.stopped) return;
  const next = C.queue.find(q => q.kind === 'follow'); if (!next) return;
  setTimeout(() => { C.queue = C.queue.filter(q => q !== next); const keep = C.text; C.text = next.text; send('now'); C.text = keep; comp.querySelector('textarea').value = keep; updateComposer(); }, 700);
}
function stopNow() {
  if (!working()) return;
  const t = stage.querySelector('.turn.live.working'); const at = clock();
  run++; C.stopped = true;
  if (t) {
    const strip = t.querySelector('.strip.working');
    if (strip) strip.outerHTML = `<div class="strip stopped"><span class="act">${ICON_STOP}Pysäytetty</span><span class="clock">${at}</span></div>`;
    t.classList.remove('working');
  }
}
comp.addEventListener('click', (e) => {
  const b = e.target.closest('[data-c]'); if (!b) return;
  if (b.getAttribute('aria-disabled') === 'true') return;
  const a = b.dataset.c;
  if (a === 'send') return primary();
  if (a === 'steer' || a === 'follow') return send(a);
  if (a === 'stop') return stopNow();
  if (a === 'mode') { C.mode = b.dataset.mode; return updateComposer(); }
  if (a === 'mode-toggle') { C.mode = C.mode === 'steer' ? 'follow' : 'steer'; return updateComposer(); }
  if (a === 'clear') { C.queue = []; return updateComposer(); }
});

buildComposer();

// Page-bar helper: fill the field with a long draft to see it grow and then scroll.
const LONG = `Ennen kuin jatkat, muutama tarkennus:

1. Älä muuta testien odotusarvoja. Jos testi on väärin, kerro se minulle ensin.
2. Päivämäärän laskenta siirretään funktioon, joka saa tämän päivän parametrina.
3. --since-lipun oletus pysyy seitsemänä päivänä.
4. Lisää testi, joka ajaa skriptin kiinteällä päivämäärällä 2026-10-13.
5. Tulosteen avainten järjestys pysyy samana kuin taulukon sarakkeissa.
6. Virheellinen päivämäärä rivillä ohitetaan edelleen varoituksella.
7. Kun kaikki on vihreää, aja koko testisarja vielä kerran ja näytä yhteenveto.

Jos jokin näistä on ristiriidassa nykyisen koodin kanssa, pysähdy ja kysy.`;
document.querySelector('.page-bar .hint').insertAdjacentHTML('beforebegin', '<button type="button" id="long-draft" class="page-btn">Pitkä luonnos</button>');
document.getElementById('long-draft').addEventListener('click', () => { const ta = comp.querySelector('textarea'); C.text = ta.value = LONG; fit(ta); updateComposer(); ta.focus(); });
