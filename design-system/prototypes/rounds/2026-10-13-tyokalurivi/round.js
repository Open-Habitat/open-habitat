// Riffikierros 13.10.2026 (conversation-actions-layout): Jari valitsi alakerrasta
// Työkalurivin (Stop vasemmalla, Ohjaa / Työn jälkeen -valinta ja Lähetä oikealla).
// Kysymys on, miten työkalurivi erottuu kirjoitusalasta, ettei laatikossa näytä
// olevan tyhjää kirjoitustilaa. Stop pysäyttää heti ilman vahvistusta (Jari 13.10.:
// agentin saa jatkamaan sanomalla "jatka").

const ICON_SEND = SVG('<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>', ' stroke-width="2.2"');
const ICON_STOP = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/></svg>';
const ICON_STEER = SVG('<path d="M5 4v6a4 4 0 0 0 4 4h10"/><path d="m15 10 4 4-4 4"/>');
const ICON_QUEUE = SVG('<path d="M4 6h12M4 12h9M4 18h6"/><path d="M18 13v7M14.5 16.5h7"/>');
const LABELS = {
  steer: ['Ohjaa', 'Ohjaa: Pi saa viestin työn välivaiheessa'],
  follow: ['Työn jälkeen', 'Työn jälkeen: viesti lähtee, kun vuoro päättyy'],
};

const C = { v: 'v1', r: 'v1', text: '', mode: 'steer', queue: [], qid: 0, was: false, t0: 0, stopped: false };
const comp = document.querySelector('.composer');
const working = () => UI.working && selConv().id === 'c1';
const clock = () => { const s = Math.max(0, Math.round((performance.now() - C.t0) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const now = () => new Date().toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');

// ---------- Pieces ----------
const sendBtn = (label = 'Lähetä', tip = label) => `<button class="c-send" type="button" data-c="send" aria-label="${label}" title="${tip}"${C.text.trim() ? '' : ' aria-disabled="true"'}>${ICON_SEND}</button>`;
const stopBtn = (size = '') => `<button class="c-stop ${size}" type="button" data-c="stop" aria-label="Pysäytä Pi:n työ" title="Pysäytä Pi:n työ">${ICON_STOP}</button>`;
const seg = () => `<div class="c-seg" role="group" aria-label="Viestin tapa työn aikana">${['steer', 'follow'].map(k => `<button type="button" data-c="mode" data-mode="${k}" aria-pressed="${C.mode === k}" title="${LABELS[k][1]}">${k === 'steer' ? ICON_STEER : ICON_QUEUE}<span>${LABELS[k][0]}</span></button>`).join('')}</div>`;
const modeChip = () => `<button class="c-chip" type="button" data-c="mode-toggle" title="${LABELS[C.mode][1]}. Vaihda napsauttamalla.">${C.mode === 'steer' ? ICON_STEER : ICON_QUEUE}<span>${LABELS[C.mode][0]}</span></button>`;
function queueHtml() {
  if (!C.queue.length) return '';
  return `<div class="q-head"><span>Jonossa ${C.queue.length}</span><button type="button" class="q-clear" data-c="clear">Tyhjennä jono</button></div><ul>${C.queue.map(q => `<li><span class="q-kind ${q.kind}">${q.kind === 'steer' ? ICON_STEER + 'Ohjaus' : ICON_QUEUE + 'Työn jälkeen'}</span><span class="q-text">${esc(q.text)}</span></li>`).join('')}</ul>`;
}

// ---------- Build per direction, update on every state change ----------
function buildComposer() {
  comp.className = `composer cmp-v1 r-${C.r}`;
  comp.innerHTML = `<div class="cwrap">
<div class="queue" aria-label="Jono"></div>
${C.v === 'v3' ? '<div class="c-status" role="status"></div>' : ''}
<div class="cbox"><textarea rows="1" aria-label="Viesti Pi:lle"></textarea>${C.r !== 'v3' ? '<div class="c-tools"></div>' : ''}</div>
${C.r === 'v3' ? '<div class="c-tools"></div>' : ''}
</div>`;
  const ta = comp.querySelector('textarea');
  ta.value = C.text; fit(ta);
  ta.addEventListener('input', () => { C.text = ta.value; fit(ta); updateComposer(); });
  ta.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    e.preventDefault(); primary();
  });
}
function fit(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'; }
function updateComposer() {
  if (!comp.querySelector('.cwrap')) return;
  const w = working(); const has = !!C.text.trim();
  if (w && !C.was) { C.t0 = performance.now(); C.stopped = false; }
  if (!w && C.was) turnEnded();
  C.was = w;
  const ta = comp.querySelector('textarea');
  ta.placeholder = w ? 'Ohjaa Pi:tä tai kirjoita työn jälkeen lähtevä viesti…' : 'Kirjoita Pi:lle…';
  const q = comp.querySelector('.queue'); q.innerHTML = queueHtml(); q.hidden = !C.queue.length;
  if (C.v === 'v1') comp.querySelector('.c-tools').innerHTML = `${w ? stopBtn() : ''}<span class="grow"></span>${w ? seg() : ''}${sendBtn(w ? LABELS[C.mode][0] : 'Lähetä', w ? LABELS[C.mode][1] : 'Lähetä')}`;
  if (C.v === 'v2') {
    comp.querySelector('.c-chipslot').innerHTML = w ? modeChip() : '';
    comp.querySelector('.c-side').innerHTML = w && !has ? stopBtn() : `${w ? stopBtn('small') : ''}${sendBtn(w ? LABELS[C.mode][0] : 'Lähetä', w ? LABELS[C.mode][1] : 'Lähetä')}`;
  }
  if (C.v === 'v3') {
    const st = comp.querySelector('.c-status'); st.hidden = !w;
    st.innerHTML = w ? `<span class="live"><span class="st-dot working"></span>Pi työskentelee</span><span class="clock">${clock()}</span><button type="button" class="c-stoptext" data-c="stop">${ICON_STOP}Pysäytä</button>` : '';
    comp.querySelector('.c-side').innerHTML = w
      ? `<button class="c-act steer" type="button" data-c="steer" aria-label="Ohjaa" title="${LABELS.steer[1]} (Enter)"${has ? '' : ' aria-disabled="true"'}>${ICON_STEER}</button><button class="c-act follow" type="button" data-c="follow" aria-label="Työn jälkeen" title="${LABELS.follow[1]}"${has ? '' : ' aria-disabled="true"'}>${ICON_QUEUE}</button>`
      : sendBtn();
  }
}
setInterval(() => { const c = comp.querySelector('.c-status .clock'); if (c && working()) c.textContent = clock(); }, 1000);
APP.painted.push(updateComposer);

// ---------- Actions ----------
function primary() { if (!working()) return send('now'); send(C.v === 'v3' ? 'steer' : C.mode); }
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

function show(v) { C.r = v; C.queue = []; C.was = false; buildComposer(); return appView(); }
const v1 = () => show('v1');
const v2 = () => show('v2');
const v3 = () => show('v3');
