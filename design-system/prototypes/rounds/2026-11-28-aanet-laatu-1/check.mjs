// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic check of the built round, not a host-backed test.
//  1. Sounds, in Node: every render of the current set (production's
//     soundSynth.ts) and of A, B and C, both lengths, through analyze.mjs:
//     −17 LUFS momentary maximum ±0.3 LU (loudness-matched), true peak under
//     −2.9 dBFS, no clipped sample, the last 50 ms under −50 dBFS; the
//     candidates' tails ring out (late decay no steeper than −160 dB/s).
//  2. The round directory holds no audio, image or HTML file and nothing over
//     100 KB: the page renders every sound from its recipe.
//  3. Headless Chromium at 1440 × 900 and 390 × 844, Päivä and Yö, every
//     direction: the shared picker contract; ten rows; every row's current
//     and candidate waveform drawn (ink on the canvas); adjacency: each ▶ sits
//     beside its own waveform (gap 0–12 px, vertically overlapping), and on
//     the desktop a row's name, two cells and actions share one line; no
//     horizontal overflow.
//  4. At 1440 Päivä: ▶ Nykyinen and ▶ candidate play the right render (set,
//     sound, length, frame count, and a checksum equal to the Node render);
//     Vertaa plays current then candidate; the other-set buttons; the length
//     toggle switches to the long renders; the volume slider sets
//     production's squared gain; Soita kaikki starts the column. No external
//     request, a clean console.
// Screenshots: <out-dir>/<direction>-<width>-<theme>.png.
import { createRequire } from 'node:module';
import { dirname, resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { checkPicker } from '../../picker-check.mjs';
import { analyse } from './analyze.mjs';
import { SETS, renderCandidate, candidateStrikes, LENGTHS } from './candidates.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, '../../../../web/package.json'));
const { chromium } = require('playwright');
const round = '2026-11-28-aanet-laatu-1';
const [input, out, flag] = process.argv.slice(2);
if (!input || !out) { console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]'); process.exit(2); }
const quick = flag === '--quick';
mkdirSync(out, { recursive: true });
let checks = 0; const errors = []; const external = [];
const ok = (v, m) => { assert.ok(v, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };

// ---- 1. Sounds ----
const prod = await import(resolve(here, '../../../../web/src/app/soundSynth.ts'));
const ids = prod.soundIds;
const renderOf = (set, id, len) => (set === 'current' ? prod.renderSound(id, len) : renderCandidate(set, id, len));
const strikesOf = (set, id, len) => (set === 'current' ? prod.soundStrikes(id, len) : candidateStrikes(set, id, len));
const checksum = (r) => { let s = 0; for (let i = 0; i < r.left.length; i += 97) s += r.left[i] + r.right[i]; return s; };
for (const set of ['current', ...SETS.map((s) => s.id)]) for (const id of ids) for (const len of ['short', 'long']) {
  const r = renderOf(set, id, len), a = analyse(r.left, r.right, 48000, strikesOf(set, id, len));
  const k = `${set}/${id}/${len}`;
  ok(Math.abs(a.lufsMomentaryMax + 17) <= 0.3, `${k}: loudness ${a.lufsMomentaryMax} LUFS`);
  ok(a.truePeakDb <= -2.9, `${k}: true peak ${a.truePeakDb}`);
  eq(a.clipped, 0, `${k}: no clipped samples`);
  ok(a.tail50Db < -50, `${k}: tail ${a.tail50Db} dBFS`);
  if (set !== 'current') {
    ok(!Number.isFinite(a.decayLateDbPerS) || a.decayLateDbPerS > -160, `${k}: rings out (${a.decayLateDbPerS} dB/s)`);
    eq(r.left.length, Math.round(LENGTHS[len] * 48000), `${k}: length`);
  }
}

// ---- 2. Round directory ----
for (const f of readdirSync(here)) {
  ok(!['.wav', '.mp3', '.ogg', '.opus', '.flac', '.png', '.jpg', '.jpeg', '.avif', '.html'].includes(extname(f).toLowerCase()), `${f}: no audio, image or HTML`);
  ok(statSync(join(here, f)).size <= 100 * 1024, `${f}: under 100 KB`);
}

// ---- 3–4. Browser ----
const browser = await chromium.launch(process.env.PROTO_CHROMIUM ? { executablePath: process.env.PROTO_CHROMIUM } : {});
const html = readFileSync(input, 'utf8');
async function open(width, height, query = '') {
  const phone = width < 600;
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: phone ? 2 : 1, hasTouch: phone, reducedMotion: 'reduce' });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/*', (r) => {
    const u = r.request().url();
    if (u.startsWith('http://prototype.test/')) return r.fulfill({ contentType: 'text/html', body: html });
    if (u.startsWith('data:') || u.startsWith('blob:')) return r.continue();
    external.push(u); return r.abort();
  });
  await page.goto('http://prototype.test/' + query);
  await page.locator('.al-row').first().waitFor();
  return page;
}
const ready = async (page) => { await page.waitForFunction(() => { const w = [...document.querySelectorAll('[data-wave]')]; return w.length === 20 && w.every((c) => c.hasAttribute('data-ready')); }, null, { timeout: 30000 }); };
const pick = async (page, d) => { await page.locator('.proto-picker-item').nth(d).click(); await page.locator(`.al-page[data-direction="${d}"]`).waitFor(); await ready(page); };
const inked = (page) => page.locator('[data-wave]').evaluateAll((cs) => cs.map((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n / (c.width * c.height); }));

// A ▶ belongs to the waveform beside it; on the desktop the row reads as one line.
async function adjacent(page, tag, desktop) {
  const res = await page.evaluate((desktop) => [...document.querySelectorAll('.al-row')].map((row) => {
    const cells = [...row.querySelectorAll('.al-cell-body')].map((b) => { const btn = b.querySelector('button').getBoundingClientRect(), w = b.querySelector('canvas').getBoundingClientRect(); return { gap: w.left - btn.right, overlap: Math.min(btn.bottom, w.bottom) - Math.max(btn.top, w.top) }; });
    const parts = ['.al-id', '.al-cell[data-set="current"]', '.al-cell:not([data-set="current"])', '.al-actions'].map((s) => row.querySelector(s).getBoundingClientRect());
    const oneLine = parts.every((p, i) => i === 0 || (p.left >= parts[i - 1].right - 0.5 && p.top < parts[0].bottom && p.bottom > parts[0].top));
    const inside = parts.every((p) => p.right <= row.getBoundingClientRect().right + 0.5);
    return { cells, oneLine: desktop ? oneLine : true, inside };
  }), desktop);
  for (const [i, r] of res.entries()) {
    for (const c of r.cells) ok(c.gap >= 0 && c.gap <= 12 && c.overlap > 10, `${tag} row ${i}: ▶ beside its waveform ${JSON.stringify(c)}`);
    ok(r.oneLine, `${tag} row ${i}: one line on the desktop`);
    ok(r.inside, `${tag} row ${i}: parts inside the row`);
  }
}

try {
  const names = ['A', 'B', 'C'];
  for (const [width, height] of quick ? [[1440, 900]] : [[1440, 900], [390, 844]]) for (const theme of quick ? ['light'] : ['light', 'dark']) {
    const page = await open(width, height, `?theme=${theme}`);
    await checkPicker(page, round);
    checks++;
    eq(await page.evaluate(() => document.documentElement.dataset.theme), theme, `${width} ${theme}: theme from ?theme=`);
    for (let d = 0; d < 3; d++) {
      const tag = `${names[d]} ${width} ${theme}`;
      await pick(page, d);
      eq(await page.locator('.al-row').count(), 10, `${tag}: ten rows`);
      eq(await page.locator(`.al-cell[data-set="${names[d]}"]`).count(), 10, `${tag}: candidate cells`);
      const ink = await inked(page);
      ok(ink.every((v) => v > 0.01), `${tag}: every waveform drawn ${ink.map((v) => v.toFixed(2))}`);
      await adjacent(page, tag, width > 600);
      ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag}: no horizontal overflow`);
      ok((await page.locator('.al-lines li[aria-current]').innerText()).startsWith(names[d]), `${tag}: current direction line`);
      await page.screenshot({ path: `${out}/${names[d]}-${width}-${theme}.png`, fullPage: d === 1 && width === 1440 });
    }
    await page.close();
  }

  // Interactions at 1440 Päivä, in B.
  const page = await open(1440, 900, '?theme=light');
  await pick(page, 1);
  const last = () => page.evaluate(() => window.__plays.at(-1));
  const count = () => page.evaluate(() => window.__plays.length);
  const node = (set, id, len) => ({ frames: renderOf(set, id, len).left.length, checksum: checksum(renderOf(set, id, len)) });
  const same = (p, set, id, len, m) => {
    const n = node(set, id, len);
    eq([p.set, p.id, p.length, p.frames], [set, id, len, n.frames], `${m}: plays ${set}/${id}/${len}`);
    ok(Math.abs(p.checksum - n.checksum) < 1e-3, `${m}: the page's render equals Node's`);
  };
  await page.getByTestId('play-current-kalimba').click(); same(await last(), 'current', 'kalimba', 'short', '▶ Nykyinen');
  ok(Math.abs((await last()).gain - 0.49) < 1e-9, 'default volume 70 % → gain 0.49');
  await page.getByTestId('play-B-lasit').click(); same(await last(), 'B', 'lasit', 'short', '▶ B');
  await page.getByTestId('other-A-jaapuikot').click(); same(await last(), 'A', 'jaapuikot', 'short', '▶ A in B');
  await page.getByTestId('other-C-kulho').click(); same(await last(), 'C', 'kulho', 'short', '▶ C in B');
  const before = await count();
  await page.getByTestId('compare-tunnus-puu').click();
  await page.waitForTimeout(100);
  same(await last(), 'current', 'tunnus-puu', 'short', 'Vertaa first');
  await page.waitForFunction((n) => window.__plays.length >= n + 2, before, { timeout: 5000 });
  same(await last(), 'B', 'tunnus-puu', 'short', 'Vertaa second');
  ok(await page.locator('.se-emblem[data-emblem="tunnus-puu"][data-active]').count() === 1, 'the playing sound\'s emblem ripples');
  await page.locator('.al-seg button[data-length="long"]').click();
  await ready(page);
  await page.getByTestId('play-B-pisara').click(); same(await last(), 'B', 'pisara', 'long', 'Pitkä');
  await page.getByTestId('play-current-pisara').click(); same(await last(), 'current', 'pisara', 'long', 'Pitkä current');
  await page.getByTestId('volume').fill('40');
  await page.getByTestId('play-B-kuplat').click();
  ok(Math.abs((await last()).gain - 0.16) < 1e-9, 'volume 40 % → gain 0.16');
  await page.getByTestId('column-B').click();
  await page.waitForTimeout(100);
  same(await last(), 'B', 'kalimba', 'long', 'Soita kaikki starts with the first sound');
  await adjacent(page, 'B 1440 long', true);
  await page.close();
} finally {
  await browser.close();
}
eq(external, [], 'no external requests');
eq(errors, [], 'clean console');
console.log(`check ok: ${checks} checks, screenshots in ${out}`);
