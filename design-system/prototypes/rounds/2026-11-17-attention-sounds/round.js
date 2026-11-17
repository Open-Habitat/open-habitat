// Attention sounds, round 1: the palette and when a sound plays.
// synth.mjs is inlined before this file (its `export`s stripped), so SOUNDS,
// FAMILIES, RECOMMENDED, renderSound, measure and volumeGain are in scope.
// The picker chooses the family; the simulated rail beside it is the same in
// every family and plays whichever sound is chosen.

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Audio: one context, unlocked by the first gesture ----------
// Browsers start an AudioContext suspended until the person has interacted
// with the page. Habitat creates it on the first pointerdown or keydown
// anywhere and resumes it there; until then a sound that should play is
// reported instead of silently lost (the rail's notice in the simulation).
let ctx = null;
const buffers = new Map();
window.__soundLog = [];
function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
  } catch { /* no audio output: the rest of the page still works */ }
  updateAudioState();
}
for (const type of ['pointerdown', 'keydown']) document.addEventListener(type, unlockAudio, { capture: true });
function updateAudioState() {
  const el = $('#audio-state');
  if (!el) return;
  const on = ctx?.state === 'running';
  el.textContent = on ? 'Ääni käytössä' : 'Ääni odottaa ensimmäistä napsautusta';
  el.dataset.on = on ? 'true' : 'false';
}
function bufferFor(id) {
  const key = `${id}@${ctx.sampleRate}`;
  if (!buffers.has(key)) {
    const samples = renderSound(SOUNDS.find(s => s.id === id), ctx.sampleRate);
    const b = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    b.copyToChannel(samples, 0);
    buffers.set(key, b);
  }
  return buffers.get(key);
}
/** Plays a sound at a gain; returns whether audio actually started. */
function playSound(id, gain, why) {
  const entry = { id, gain: +gain.toFixed(4), why, state: ctx?.state ?? 'none' };
  window.__soundLog.push(entry);
  if (ctx?.state !== 'running' || gain <= 0) return false;
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = bufferFor(id);
  g.gain.value = gain;
  src.connect(g).connect(ctx.destination);
  src.onended = () => { src.disconnect(); g.disconnect(); };
  src.start();
  entry.started = true;
  return true;
}
// For the check: the same buffer and gain chain, rendered offline.
window.renderOffline = async (id, volume = 100, muted = false) => {
  const sr = 48000, off = new OfflineAudioContext(1, sr, sr);
  const samples = renderSound(SOUNDS.find(s => s.id === id), sr);
  const b = off.createBuffer(1, samples.length, sr); b.copyToChannel(samples, 0);
  const src = off.createBufferSource(), g = off.createGain();
  src.buffer = b; g.gain.value = volumeGain(volume, muted); src.connect(g).connect(off.destination); src.start();
  const out = (await off.startRendering()).getChannelData(0);
  let peak = 0, last = -1;
  for (let i = 0; i < out.length; i++) { const a = Math.abs(out[i]); if (a > peak) peak = a; if (a > 1e-4) last = i; }
  return { peak, duration: (last + 1) / sr, length: samples.length / sr };
};

// ---------- Palette ----------
const state = { family: 0, chosen: RECOMMENDED.sound };
const soundName = (id) => SOUNDS.find(s => s.id === id).name;

function drawWave(canvas, samples) {
  const dpr = devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const c = canvas.getContext('2d');
  c.scale(dpr, dpr);
  c.fillStyle = getComputedStyle(canvas).color;
  const per = samples.length / w;
  for (let x = 0; x < w; x++) {
    let lo = 0, hi = 0;
    for (let i = Math.floor(x * per); i < Math.floor((x + 1) * per); i++) { if (samples[i] < lo) lo = samples[i]; if (samples[i] > hi) hi = samples[i]; }
    // 1.0 s spans the canvas; the peak (0.5) reaches the edges.
    c.fillRect(x, h / 2 - hi * h, 1, Math.max(1, (hi - lo) * h));
  }
}

function renderFamily(i) {
  state.family = i;
  const fam = FAMILIES[i];
  document.querySelectorAll('.as-families li').forEach((li, j) => li.toggleAttribute('aria-current', j === i));
  const list = SOUNDS.filter(s => s.family === fam.id);
  $('#palette').innerHTML = `
    <h2 class="as-h2">${esc(fam.id)} ${esc(fam.name)}</h2>
    <p class="as-lead">${esc(fam.line)}</p>
    <div class="as-grid">${list.map(s => {
      const m = measure(renderSound(s, 8000), 8000);
      return `<article class="as-sound" data-sound="${s.id}"${s.id === RECOMMENDED.sound ? ' data-recommended' : ''}${s.id === state.chosen ? ' data-chosen' : ''}>
        <header><h3>${esc(s.name)}</h3>${s.id === RECOMMENDED.sound ? '<span class="as-badge">Suositus</span>' : ''}</header>
        <p class="as-desc">${esc(s.desc)}</p>
        <canvas class="as-wave" aria-hidden="true" style="--len:${s.dur}"></canvas>
        <p class="as-how"><span class="as-ms">${Math.round(s.dur * 1000)} ms, kuuluu ${Math.round(m.audible * 1000)} ms</span> ${esc(s.how)}</p>
        <div class="as-actions">
          <button type="button" class="as-btn as-primary" data-play="${s.id}" aria-label="Soita ${esc(s.name)}">▶ Soita</button>
          <button type="button" class="as-btn" data-day="${s.id}" title="Soittaa äänen neljästi 1,5 s välein: kestääkö se toistoa?">Neljästi</button>
          <label class="as-choose"><input type="radio" name="chosen" value="${s.id}"${s.id === state.chosen ? ' checked' : ''}> Sivupalkin ääni</label>
        </div>
      </article>`;
    }).join('')}</div>`;
  requestAnimationFrame(() => document.querySelectorAll('.as-sound').forEach(card => {
    const s = SOUNDS.find(x => x.id === card.dataset.sound);
    drawWave(card.querySelector('canvas'), renderSound(s, 8000));
  }));
}

document.addEventListener('click', (e) => {
  const play = e.target.closest('[data-play]');
  if (play) { unlockAudio(); playSound(play.dataset.play, volumeGain(sim.volume, sim.muted), 'palette'); return; }
  const day = e.target.closest('[data-day]');
  if (day) {
    unlockAudio();
    for (let k = 0; k < 4; k++) setTimeout(() => playSound(day.dataset.day, volumeGain(sim.volume, sim.muted), 'repeat'), k * 1500);
  }
});
document.addEventListener('change', (e) => {
  if (e.target.name === 'chosen') {
    state.chosen = e.target.value;
    document.querySelectorAll('.as-sound').forEach(c => c.toggleAttribute('data-chosen', c.dataset.sound === state.chosen));
    $('#chosen-name').textContent = soundName(state.chosen);
  }
});

// ---------- Simulated rail ----------
// The rules this round recommends (result-sounds.md):
//  1. A sound plays when a conversation enters Sinun vuorosi because of the
//     agent: a new reply, a question, a turn that ends with no worker left.
//  2. The agent placing itself in Käynnissä or Hiljaiset is silent, and so is
//     a turn that ends while a worker still runs; the sound comes when the
//     work ends and the reply claims the turn.
//  3. One sound per COALESCE_MS: arrivals inside it are merged into the first.
//  4. No sound for the conversation the person is looking at (tab visible,
//     window focused, that conversation open). Another conversation, another
//     tab or a hidden window sounds.
//  5. Personal volume and mute; reduced motion does not silence sound.
//  6. Locked audio is reported in the rail once, with a button; any click
//     in Habitat unlocks it too.
const COALESCE_MS = 3000;
const START = [
  { id: 'cleanup', title: 'Hakemiston siivous', ws: 'kotisivu', section: 'running', line: 'Työskentelee' },
  { id: 'release', title: 'Julkaisun tarkistus', ws: 'open-habitat', section: 'running', line: 'Työskentelee' },
  { id: 'tiles', title: 'Karttalaattojen haku', ws: 'kartta', section: 'running', line: 'Työskentelee · 1 työntekijä' },
  { id: 'notes', title: 'Kokousmuistion kooste', ws: 'muistiot', section: 'running', line: 'Työskentelee' },
  { id: 'deps', title: 'Riippuvuuksien päivitys', ws: 'api', section: 'running', line: 'Työskentelee' },
  { id: 'tests', title: 'Testien korjaus', ws: 'api', section: 'running', line: 'Työskentelee' },
  { id: 'strings', title: 'Käännösten tarkistus', ws: 'web', section: 'running', line: 'Työskentelee' },
  { id: 'receipts', title: 'Kuittien arkistointi', ws: 'kirjanpito', section: 'quiet', line: 'Valmis eilen' },
];
const sim = { volume: 70, muted: false, locked: false, reduced: false, where: 'other', open: 'receipts', convs: [], log: [], lastPlay: -Infinity, notice: false, timers: [] };

function resetSim() {
  sim.timers.forEach(clearTimeout); sim.timers = [];
  sim.convs = START.map(c => ({ ...c }));
  sim.log = []; sim.lastPlay = -Infinity; sim.notice = false; sim.open = 'receipts';
  renderRail();
}

function log(outcome, text) {
  sim.log.unshift({ outcome, text, at: new Date().toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) });
  sim.log.length = Math.min(sim.log.length, 12);
}

/** Applies one change of the agent's state and decides whether it sounds. */
function apply(id, section, line, cause, keepOpen = false) {
  const c = sim.convs.find(x => x.id === id);
  const from = c.section;
  if (sim.where === 'this' && !keepOpen) sim.open = id;
  c.section = section; c.line = line; c.arrived = section === 'yours' && from !== 'yours';
  if (!c.arrived) { log('silent', `${c.title}: ${cause}. Ei ääntä, koska vuoro ei siirtynyt sinulle.`); renderRail(); return; }
  if (sim.where === 'this' && sim.open === id) { log('silent', `${c.title}: ${cause}. Ei ääntä: katsot jo tätä keskustelua.`); renderRail(); return; }
  if (sim.muted || sim.volume === 0) { log('silent', `${c.title}: ${cause}. Ei ääntä: äänet ovat pois.`); renderRail(); return; }
  const now = performance.now();
  if (now - sim.lastPlay < COALESCE_MS) { log('merged', `${c.title}: ${cause}. Yhdistetty edelliseen ääneen.`); renderRail(); return; }
  sim.lastPlay = now;
  if (sim.locked || ctx?.state !== 'running') {
    sim.notice = true;
    log('blocked', `${c.title}: ${cause}. Selain esti äänen; sivupalkki kertoo sen.`);
    window.__soundLog.push({ id: state.chosen, gain: 0, why: 'blocked', state: sim.locked ? 'locked' : ctx?.state ?? 'none' });
    renderRail(); return;
  }
  const gain = volumeGain(sim.volume, sim.muted);
  playSound(state.chosen, gain, id);
  log('played', `${c.title}: ${cause}. Soi ${soundName(state.chosen)}, ${sim.volume} %.`);
  renderRail();
}

const EVENTS = {
  reply: () => apply('cleanup', 'yours', 'Uusi vastaus', 'vastaus valmis'),
  ask: () => apply('release', 'yours', 'Kysyy: julkaistaanko 0.9.2?', 'agentti kysyy'),
  'turn-worker': () => apply('tiles', 'running', 'Vuoro päättyi · työntekijä jatkaa', 'vuoro päättyi, työntekijä vielä töissä'),
  'worker-done': () => apply('tiles', 'yours', 'Uusi vastaus · työntekijät valmiit', 'viimeinen työntekijä valmis, vastaus jää sinulle'),
  'self-running': () => apply('notes', 'running', 'Agentti: odottaa työntekijöitä', 'agentti asetti itsensä Käynnissä-osioon'),
  'self-quiet': () => apply('notes', 'quiet', 'Agentti: valmis, ei odota mitään', 'agentti asetti itsensä Hiljaisiin'),
  burst: () => {
    // Looking at "the conversation that finishes" means the first of the three.
    if (sim.where === 'this') sim.open = 'tests';
    const trio = [['tests', 'Uusi vastaus'], ['deps', 'Uusi vastaus'], ['strings', 'Uusi vastaus']];
    trio.forEach(([id, line], k) => sim.timers.push(setTimeout(() => apply(id, 'yours', line, `valmistui (${k + 1}/3, ${k * 400} ms)`, true), k * 400)));
  },
};

const SECTIONS = [['yours', 'Sinun vuorosi'], ['running', 'Käynnissä'], ['quiet', 'Hiljaiset']];
function renderRail() {
  const rail = $('#rail');
  if (!rail) return;
  const hidden = sim.where === 'hidden';
  const unread = sim.convs.filter(c => c.section === 'yours').length;
  rail.innerHTML = `
    <div class="as-tab" data-testid="tab-title"><span class="as-tab-dot" aria-hidden="true"></span>${hidden && unread ? 'Agentti tarvitsee huomiota · ' : ''}Open Habitat${hidden ? ' <span class="as-faint">· välilehti taustalla</span>' : ''}</div>
    ${sim.notice ? `<div class="as-notice" role="status" data-testid="unlock-notice">
      <p>Ääni ei soinut. Selain soittaa ääniä vasta, kun olet käyttänyt sivua.</p>
      <button type="button" class="as-btn as-primary" data-testid="unlock">Ota äänet käyttöön</button></div>` : ''}
    ${SECTIONS.map(([key, label]) => {
      const rows = sim.convs.filter(c => c.section === key);
      return `<section class="as-sec" data-testid="rail-${key}"><h3>${label} <span class="as-count">${rows.length}</span></h3>
        <ul>${rows.map(c => `<li class="as-row${c.arrived && key === 'yours' ? ' as-arrived' : ''}" data-testid="row-${c.id}"${sim.open === c.id && !hidden ? ' aria-current="page"' : ''}>
          <span class="as-mark" data-state="${key}" aria-hidden="true"></span>
          <span class="as-row-text"><span class="as-title">${esc(c.title)}</span> <code>${esc(c.ws)}</code><span class="as-line">${esc(c.line)}</span></span></li>`).join('')}</ul></section>`;
    }).join('')}`;
  $('#sound-log').innerHTML = sim.log.map(l => `<li data-outcome="${l.outcome}"><span class="as-outcome">${{ played: 'Soi', silent: 'Hiljaa', merged: 'Yhdistetty', blocked: 'Estetty' }[l.outcome]}</span> ${esc(l.text)} <time>${l.at}</time></li>`).join('') || '<li class="as-faint">Valitse tapahtuma.</li>';
}

function simHtml() {
  return `
  <div class="as-sim-controls">
    <fieldset class="as-where"><legend>Missä olet</legend>
      <label><input type="radio" name="where" value="this"> Katsot keskustelua, joka valmistuu</label>
      <label><input type="radio" name="where" value="other" checked> Katsot toista keskustelua</label>
      <label><input type="radio" name="where" value="hidden"> Habitat toisessa välilehdessä tai ikkuna taustalla</label>
    </fieldset>
    <div class="as-levels">
      <label class="as-volume">Äänenvoimakkuus <input type="range" id="volume" min="0" max="100" step="5" value="70"> <output id="volume-out">70 %</output></label>
      <label><input type="checkbox" id="muted"> Äänet pois</label>
      <label><input type="checkbox" id="locked"> Selain ei ole vielä sallinut ääntä</label>
      <label><input type="checkbox" id="reduced"> Vähennä liikettä</label>
      <p class="as-faint">Sivupalkin ääni: <strong id="chosen-name">${esc(soundName(state.chosen))}</strong> · <span id="audio-state" data-on="false"></span></p>
    </div>
  </div>
  <div class="as-events" role="group" aria-label="Tapahtumat">
    <button type="button" class="as-btn" data-event="reply" data-testid="event-reply">Vastaus valmis</button>
    <button type="button" class="as-btn" data-event="ask" data-testid="event-ask">Agentti kysyy</button>
    <button type="button" class="as-btn" data-event="turn-worker" data-testid="event-turn-worker">Vuoro päättyy, työntekijä jatkaa</button>
    <button type="button" class="as-btn" data-event="worker-done" data-testid="event-worker-done">Työntekijä valmis</button>
    <button type="button" class="as-btn" data-event="self-running" data-testid="event-self-running">Agentti: Käynnissä</button>
    <button type="button" class="as-btn" data-event="self-quiet" data-testid="event-self-quiet">Agentti: Hiljaiset</button>
    <button type="button" class="as-btn" data-event="burst" data-testid="event-burst">Kolme valmistuu peräkkäin</button>
    <button type="button" class="as-btn as-quiet" data-event="reset" data-testid="event-reset">Alusta</button>
  </div>
  <div class="as-sim-body">
    <nav class="as-rail" id="rail" aria-label="Simuloitu sivupalkki"></nav>
    <div class="as-log-wrap"><h3 class="as-h3">Mitä tapahtui</h3><ol class="as-log" id="sound-log" data-testid="sound-log" aria-live="polite"></ol></div>
  </div>`;
}

function mountSim() {
  $('#sim-body').innerHTML = simHtml();
  const vol = $('#volume');
  vol.addEventListener('input', () => { sim.volume = +vol.value; $('#volume-out').textContent = `${sim.volume} %`; });
  $('#muted').addEventListener('change', e => { sim.muted = e.target.checked; });
  $('#locked').addEventListener('change', e => { sim.locked = e.target.checked; if (!sim.locked) sim.notice = false; renderRail(); });
  $('#reduced').addEventListener('change', e => { sim.reduced = e.target.checked; document.documentElement.toggleAttribute('data-reduced', sim.reduced); });
  document.querySelectorAll('input[name="where"]').forEach(r => r.addEventListener('change', () => { sim.where = r.value; renderRail(); }));
  $('#sim-body').addEventListener('click', (e) => {
    const ev = e.target.closest('[data-event]');
    if (ev) { if (ev.dataset.event === 'reset') resetSim(); else EVENTS[ev.dataset.event](); return; }
    if (e.target.closest('[data-testid="unlock"]')) {
      // The person's click is the gesture; confirm with the sound itself.
      sim.locked = false; $('#locked').checked = false; sim.notice = false;
      unlockAudio();
      playSound(state.chosen, volumeGain(sim.volume, sim.muted), 'unlock');
      log('played', `Äänet käytössä. Soi ${soundName(state.chosen)} vahvistukseksi.`);
      renderRail();
    }
  });
  updateAudioState();
  resetSim();
}

// ---------- Page ----------
const theme = $('#theme');
function applyTheme() {
  const v = theme.value === 'system'
    ? (matchMedia('(prefers-contrast: more)').matches ? 'contrast' : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme.value;
  document.documentElement.dataset.theme = v;
  renderFamily(state.family);
}
theme.value = new URLSearchParams(location.search).get('theme') || 'system';
theme.addEventListener('change', applyTheme);
mountSim();
applyTheme();

const variants = FAMILIES.map((_, i) => () => String(i + 1));
const stageSink = { set innerHTML(v) { if (v) renderFamily(Number(v) - 1); } };
