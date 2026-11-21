// Attention sounds, round 3: the accepted sounds polished, as before/after
// pairs, plus new candidates and the whole set. synth.mjs is inlined before
// this file (its `export`s stripped), so SOUNDS, BEFORE, ALL, VIEWS,
// DEFAULT_SOUND, renderSound, measure, momentaryMax and volumeGain are in scope.

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const byId = (id) => ALL.find(s => s.id === id);
const dB = (x) => (20 * Math.log10(Math.max(x, 1e-9))).toFixed(0);

// ---------- Audio ----------
// One context, created and resumed on the first gesture (browsers keep audio
// locked until then). Every sound is rendered once at 48 kHz into a stereo
// AudioBuffer; the browser resamples if the context runs at another rate, so
// the samples are the ones render.mjs fingerprints.
let ctx = null;
const rendered = new Map(), buffers = new Map();
window.__soundLog = [];
function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
  } catch { /* no audio output: the page still works */ }
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
const samplesFor = (id) => { if (!rendered.has(id)) rendered.set(id, renderSound(byId(id))); return rendered.get(id); };
function toBuffer(c, x) {
  const b = c.createBuffer(2, x.left.length, SAMPLE_RATE);
  b.copyToChannel(x.left, 0); b.copyToChannel(x.right, 1);
  return b;
}
const volume = { value: 70, muted: false };
let playing = [];
function playSound(id, why = 'palette', when = 0) {
  const gain = volumeGain(volume.value, volume.muted);
  const entry = { id, gain: +gain.toFixed(4), why, state: ctx?.state ?? 'none' };
  window.__soundLog.push(entry);
  if (ctx?.state !== 'running' || gain <= 0) return false;
  if (!buffers.has(id)) buffers.set(id, toBuffer(ctx, samplesFor(id)));
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = buffers.get(id); g.gain.value = gain;
  src.connect(g).connect(ctx.destination);
  src.onended = () => { src.disconnect(); g.disconnect(); playing = playing.filter(p => p !== src); };
  src.start(ctx.currentTime + when);
  playing.push(src);
  entry.started = true;
  return true;
}
function stopAll() { for (const s of playing) try { s.stop(); } catch { /* already ended */ } playing = []; }
// For the check: the page's own buffer and gain chain, rendered offline.
window.renderOffline = async (id, vol = 100, muted = false) => {
  const x = samplesFor(id);
  const off = new OfflineAudioContext(2, Math.round((MAX_DUR + 0.1) * SAMPLE_RATE), SAMPLE_RATE);
  const src = off.createBufferSource(), g = off.createGain();
  src.buffer = toBuffer(off, x); g.gain.value = volumeGain(vol, muted);
  src.connect(g).connect(off.destination); src.start();
  const out = await off.startRendering();
  const L = out.getChannelData(0), R = out.getChannelData(1);
  const n = x.left.length, tailFrom = n - Math.round(0.05 * SAMPLE_RATE);
  let peak = 0, last = -1, tail = 0;
  for (let i = 0; i < L.length; i++) {
    const a = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    if (a > peak) peak = a;
    if (a > 1e-4) last = i;
    if (i >= tailFrom && i < n && a > tail) tail = a;
  }
  return { peak, tail, duration: (last + 1) / SAMPLE_RATE, length: n / SAMPLE_RATE, lufs: peak ? momentaryMax(L, R) : -Infinity, first: Math.max(Math.abs(L[0]), Math.abs(R[0])) };
};

// ---------- Cards ----------
const state = { view: 0 };
const GROUPS = [['soitin', 'Soittimet'], ['luonto', 'Luonto ja esineet']];
const badges = (s) => [
  s.id === DEFAULT_SOUND ? '<span class="as-badge">Oletus</span>' : '',
  s.isNew ? '<span class="as-badge as-badge-soft">Uusi ehdokas</span>' : ''].join('');

// 1.6 s spans the canvas whatever the sound, so a before and an after wave
// share one time scale and the cut-off ending is visible as a wall.
function drawWave(canvas, x) {
  const dpr = devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w) return;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const c = canvas.getContext('2d');
  c.scale(dpr, dpr);
  c.fillStyle = getComputedStyle(canvas).color;
  const per = (MAX_DUR * SAMPLE_RATE) / w;
  for (let px = 0; px < w; px++) {
    let l = 0, r = 0;
    const a = Math.floor(px * per), b = Math.min(x.left.length, Math.floor((px + 1) * per));
    if (a >= x.left.length) break;
    for (let i = a; i < b; i++) { l = Math.max(l, Math.abs(x.left[i])); r = Math.max(r, Math.abs(x.right[i])); }
    const hl = Math.max(0.5, l / PEAK_CEIL * (h / 2 - 2)), hr = Math.max(0.5, r / PEAK_CEIL * (h / 2 - 2));
    c.globalAlpha = 1; c.fillRect(px, h / 2 - hl, 1, hl);
    c.globalAlpha = 0.6; c.fillRect(px, h / 2, 1, hr);
  }
}

const meta = (id) => {
  const x = samplesFor(id), m = measure(x);
  return `<span>${Math.round(m.duration * 1000)} ms</span><span>${m.lufs.toFixed(1)} LUFS-M</span><span title="Viimeiset 50 ms ennen loppuhäivytystä">häntä ${dB(x.rawTail)} dB</span>`;
};
const how = (s) => `<details class="as-how"><summary>Miten tehty</summary><p>${esc(s.how)}</p></details>`;

function pairCard(s) {
  const b = byId(s.before);
  return `<article class="as-sound" data-sound="${s.id}"${s.id === DEFAULT_SOUND ? ' data-recommended' : ''}>
    <header><h3>${esc(s.name)}</h3>${badges(s)}<code class="as-id" title="Pysyvä tunniste">${esc(s.id)}</code></header>
    <p class="as-desc">${esc(s.desc)}</p>
    <div class="as-pair">
      <span class="as-wave-label">Kierros 2</span><canvas class="as-wave as-wave-before" data-wave="${b.id}" aria-hidden="true"></canvas>
      <p class="as-meta">${meta(b.id)}</p>
      <span class="as-wave-label">Kierros 3</span><canvas class="as-wave" data-wave="${s.id}" aria-hidden="true"></canvas>
      <p class="as-meta">${meta(s.id)}</p>
    </div>
    ${how(s)}
    <div class="as-actions">
      <button type="button" class="as-btn as-primary" data-play="${s.id}" aria-label="Soita ${esc(s.name)}, kierros 3">▶ Uusi</button>
      <button type="button" class="as-btn" data-play="${b.id}" aria-label="Soita ${esc(s.name)}, kierros 2">▶ Kierros 2</button>
      <button type="button" class="as-btn" data-ab="${s.id}" title="Soittaa ensin kierroksen 2 version ja sitten uuden">Vertaa</button>
      <button type="button" class="as-btn as-quiet" data-day="${s.id}" title="Soittaa uuden version neljästi 1,8 s välein: kestääkö se toistoa?">Neljästi</button>
    </div>
  </article>`;
}

function soloCard(s) {
  return `<article class="as-sound" data-sound="${s.id}"${s.id === DEFAULT_SOUND ? ' data-recommended' : ''}>
    <header><h3>${esc(s.name)}</h3>${badges(s)}<code class="as-id" title="Pysyvä tunniste">${esc(s.id)}</code></header>
    <p class="as-desc">${esc(s.desc)}</p>
    <canvas class="as-wave" data-wave="${s.id}" aria-hidden="true"></canvas>
    <p class="as-meta">${meta(s.id)}</p>
    ${how(s)}
    <div class="as-actions">
      <button type="button" class="as-btn as-primary" data-play="${s.id}" aria-label="Soita ${esc(s.name)}">▶ Soita</button>
      <button type="button" class="as-btn as-quiet" data-day="${s.id}" title="Soittaa äänen neljästi 1,8 s välein: kestääkö se toistoa?">Neljästi</button>
    </div>
  </article>`;
}

function setRow(s) {
  return `<li class="as-row" data-sound="${s.id}"${s.id === DEFAULT_SOUND ? ' data-recommended' : ''}>
    <button type="button" class="as-btn as-play-round" data-play="${s.id}" aria-label="Soita ${esc(s.name)}">▶</button>
    <span class="as-row-name">${esc(s.name)}</span><span class="as-row-badges">${badges(s)}</span>
    <canvas class="as-wave as-wave-mini" data-wave="${s.id}" aria-hidden="true"></canvas>
    <code class="as-id">${esc(s.id)}</code>
  </li>`;
}

function renderView(i) {
  state.view = i;
  const view = VIEWS[i];
  document.querySelectorAll('.as-views li').forEach((li, j) => li.toggleAttribute('aria-current', j === i));
  let body;
  if (view.id === 'A') body = `<div class="as-grid">${SOUNDS.filter(s => s.before).map(pairCard).join('')}</div>`;
  else if (view.id === 'B') body = `<div class="as-grid">${SOUNDS.filter(s => s.isNew).map(soloCard).join('')}</div>`;
  else body = GROUPS.map(([g, name]) => `<h3 class="as-group">${esc(name)}</h3>
    <ul class="as-set">${SOUNDS.filter(s => s.group === g).map(setRow).join('')}</ul>`).join('');
  $('#palette').innerHTML = `
    <div class="as-fam-head"><h2 class="as-h2">${esc(view.id)} ${esc(view.name)}</h2>
      <button type="button" class="as-btn" data-all="${view.id}">Soita kaikki</button></div>
    <p class="as-lead">${esc(view.line)}</p>
    ${body}`;
  requestAnimationFrame(() => document.querySelectorAll('[data-wave]').forEach(c => drawWave(c, samplesFor(c.dataset.wave))));
}

// What "Soita kaikki" plays in each view: pairs play before, then after.
const viewSequence = (id) => id === 'A'
  ? SOUNDS.filter(s => s.before).flatMap(s => [s.before, s.id])
  : id === 'B' ? SOUNDS.filter(s => s.isNew).map(s => s.id)
  : GROUPS.flatMap(([g]) => SOUNDS.filter(s => s.group === g).map(s => s.id));

document.addEventListener('click', (e) => {
  const t = e.target;
  const play = t.closest('[data-play]');
  if (play) { unlockAudio(); stopAll(); playSound(play.dataset.play); return; }
  const day = t.closest('[data-day]');
  if (day) { unlockAudio(); stopAll(); for (let k = 0; k < 4; k++) playSound(day.dataset.day, 'repeat', k * 1.8); return; }
  const ab = t.closest('[data-ab]');
  if (ab) { unlockAudio(); stopAll(); playSound(byId(ab.dataset.ab).before, 'compare'); playSound(ab.dataset.ab, 'compare', 1.6); return; }
  const all = t.closest('[data-all]');
  if (all) { unlockAudio(); stopAll(); viewSequence(all.dataset.all).forEach((id, k) => playSound(id, 'all', k * 1.9)); }
});

// ---------- Page ----------
const vol = $('#volume');
vol.addEventListener('input', () => { volume.value = +vol.value; $('#volume-out').textContent = `${volume.value} %`; });
$('#muted').addEventListener('change', (e) => { volume.muted = e.target.checked; });
const theme = $('#theme');
function applyTheme() {
  const v = theme.value === 'system'
    ? (matchMedia('(prefers-contrast: more)').matches ? 'contrast' : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme.value;
  document.documentElement.dataset.theme = v;
  renderView(state.view);
}
theme.value = new URLSearchParams(location.search).get('theme') || 'system';
theme.addEventListener('change', applyTheme);
let resizeTimer = 0;
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => renderView(state.view), 150); });
updateAudioState();
applyTheme();

const variants = VIEWS.map((_, i) => () => String(i + 1));
const stageSink = { set innerHTML(v) { if (v) renderView(Number(v) - 1); } };
