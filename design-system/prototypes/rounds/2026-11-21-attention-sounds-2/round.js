// Attention sounds, round 2: a richer palette, one family per picker direction.
// synth.mjs is inlined before this file (its `export`s stripped), so SOUNDS,
// FAMILIES, RECOMMENDED, renderSound, measure, momentaryMax and volumeGain are
// in scope. The rules of when a sound plays were settled in round 1 and are not
// repeated here; this page is about the sounds.

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const byId = (id) => SOUNDS.find(s => s.id === id);

// ---------- Audio ----------
// One context, created and resumed on the first gesture (browsers keep audio
// locked until then). Every sound is rendered once at 48 kHz into a stereo
// AudioBuffer; the browser resamples if the context runs at another rate, so
// the samples are the same as render.mjs fingerprints.
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
  const off = new OfflineAudioContext(2, Math.round(1.3 * SAMPLE_RATE), SAMPLE_RATE);
  const src = off.createBufferSource(), g = off.createGain();
  src.buffer = toBuffer(off, x); g.gain.value = volumeGain(vol, muted);
  src.connect(g).connect(off.destination); src.start();
  const out = await off.startRendering();
  const L = out.getChannelData(0), R = out.getChannelData(1);
  let peak = 0, last = -1;
  for (let i = 0; i < L.length; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (a > peak) peak = a; if (a > 1e-4) last = i; }
  return { peak, duration: (last + 1) / SAMPLE_RATE, length: x.left.length / SAMPLE_RATE, lufs: peak ? momentaryMax(L, R) : -Infinity, first: Math.max(Math.abs(L[0]), Math.abs(R[0])) };
};

// ---------- Palette ----------
const state = { family: 0 };
const badges = (s) => [
  s.id === RECOMMENDED.sound ? '<span class="as-badge">Oletus</span>' : '',
  s.id !== RECOMMENDED.sound && RECOMMENDED.shortlist.includes(s.id) ? '<span class="as-badge as-badge-soft">Lyhytlista</span>' : '',
  s.reference ? '<span class="as-badge as-badge-ref">Kierros 1</span>' : ''].join('');

function drawWave(canvas, x) {
  const dpr = devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w) return;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const c = canvas.getContext('2d');
  c.scale(dpr, dpr);
  c.fillStyle = getComputedStyle(canvas).color;
  // 1.2 s spans the canvas; left channel above the midline, right below it.
  const per = (MAX_DUR * SAMPLE_RATE) / w;
  for (let px = 0; px < w; px++) {
    let l = 0, r = 0;
    const a = Math.floor(px * per), b = Math.min(x.left.length, Math.floor((px + 1) * per));
    for (let i = a; i < b; i++) { l = Math.max(l, Math.abs(x.left[i])); r = Math.max(r, Math.abs(x.right[i])); }
    if (a >= x.left.length) break;
    const hl = Math.max(0.5, l / PEAK_CEIL * (h / 2 - 2)), hr = Math.max(0.5, r / PEAK_CEIL * (h / 2 - 2));
    c.globalAlpha = 1; c.fillRect(px, h / 2 - hl, 1, hl);
    c.globalAlpha = 0.6; c.fillRect(px, h / 2, 1, hr);
  }
}

function card(s) {
  const m = measure(samplesFor(s.id));
  return `<article class="as-sound" data-sound="${s.id}"${s.id === RECOMMENDED.sound ? ' data-recommended' : ''}${s.reference ? ' data-reference' : ''}>
    <header><h3>${esc(s.name)}</h3>${badges(s)}<code class="as-id" title="Pysyvä tunniste">${esc(s.id)}</code></header>
    <p class="as-desc">${esc(s.desc)}</p>
    <canvas class="as-wave" aria-hidden="true"></canvas>
    <p class="as-meta"><span>${Math.round(m.duration * 1000)} ms</span><span>kuuluu ${Math.round(m.audible * 1000)} ms</span><span>${m.lufs.toFixed(1)} LUFS-M</span><span>huippu ${(20 * Math.log10(m.peak)).toFixed(1)} dBFS</span></p>
    <details class="as-how"><summary>Miten tehty</summary><p>${esc(s.how)}</p></details>
    <div class="as-actions">
      <button type="button" class="as-btn as-primary" data-play="${s.id}" aria-label="Soita ${esc(s.name)}">▶ Soita</button>
      <button type="button" class="as-btn" data-day="${s.id}" title="Soittaa äänen neljästi 1,5 s välein: kestääkö se toistoa?">Neljästi</button>
      ${s.reference ? '' : `<button type="button" class="as-btn as-quiet" data-ab="${s.id}" title="Soittaa ensin kierroksen 1 Ovin ja sitten tämän">Ovi ensin</button>`}
    </div>
  </article>`;
}

function renderFamily(i) {
  state.family = i;
  const fam = FAMILIES[i];
  document.querySelectorAll('.as-families li').forEach((li, j) => li.toggleAttribute('aria-current', j === i));
  const list = SOUNDS.filter(s => s.family === fam.id);
  $('#palette').innerHTML = `
    <div class="as-fam-head"><h2 class="as-h2">${esc(fam.id)} ${esc(fam.name)}</h2>
      <button type="button" class="as-btn" data-all="${fam.id}">Soita kaikki</button></div>
    <p class="as-lead">${esc(fam.line)}</p>
    <div class="as-grid">${list.map(card).join('')}</div>`;
  requestAnimationFrame(() => document.querySelectorAll('.as-sound').forEach(el => drawWave(el.querySelector('canvas'), samplesFor(el.dataset.sound))));
}

document.addEventListener('click', (e) => {
  const t = e.target;
  const play = t.closest('[data-play]');
  if (play) { unlockAudio(); stopAll(); playSound(play.dataset.play); return; }
  const day = t.closest('[data-day]');
  if (day) { unlockAudio(); stopAll(); for (let k = 0; k < 4; k++) playSound(day.dataset.day, 'repeat', k * 1.5); return; }
  const ab = t.closest('[data-ab]');
  if (ab) { unlockAudio(); stopAll(); playSound('r1-ovi', 'compare'); playSound(ab.dataset.ab, 'compare', 1.3); return; }
  const all = t.closest('[data-all]');
  if (all) {
    unlockAudio(); stopAll();
    SOUNDS.filter(s => s.family === all.dataset.all).forEach((s, k) => playSound(s.id, 'family', k * 1.6));
  }
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
  renderFamily(state.family);
}
theme.value = new URLSearchParams(location.search).get('theme') || 'system';
theme.addEventListener('change', applyTheme);
let resizeTimer = 0;
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => renderFamily(state.family), 150); });
updateAudioState();
applyTheme();

const variants = FAMILIES.map((_, i) => () => String(i + 1));
const stageSink = { set innerHTML(v) { if (v) renderFamily(Number(v) - 1); } };
