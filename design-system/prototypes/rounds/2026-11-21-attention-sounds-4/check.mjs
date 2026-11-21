#!/usr/bin/env node
// node check.mjs <page.html> [out-dir] [--quick]
// Authored check of the built round, not a host-backed test.
//  1. render.mjs: 9 kept and 5 redone sounds (at most 15), stable ids; both
//     lengths of every sound inside their band (short 0.5–0.8 s, long
//     1.2–1.6 s), loudness at the target ±0.5 LU, peak under −3 dBFS, no onset
//     click, the last 50 ms under −50 dBFS and under −45 dBFS even before the
//     final fade (a natural decay, not a cut), under −30 dB of energy above
//     6 kHz, stereo width; every fingerprint unchanged, and round 4's versions
//     identical to round 4's own fingerprints while that directory exists.
//  2. The round directory holds no audio, PNG, JPEG or HTML file and no file
//     over 100 KB (the page renders the sounds from their recipes).
//  3. Headless Chromium at 1280 and 390 px in Päivä, Yö and Korkea kontrasti:
//     the shared picker, one line per view, cards with round 4, short and long
//     waveforms drawn, the whole set with the default marked once, the length
//     toggle, stable ids, no overflow.
//  4. Audio at 1280 Päivä: every render through the page's own buffer and gain
//     chain in an OfflineAudioContext (length band, loudness at 100 %, peak at
//     100 % and 50 %, last 50 ms under −50 dBFS, muted silence, no onset
//     click); a click unlocks audio; Lyhyt, Pitkä and Kierros 4 play their
//     render; Vertaa plays round 4, short, long; the length toggle changes
//     what Neljästi, the set rows and Soita kaikki play.
// Screenshots go to out-dir, default /var/tmp/agent-keep/attention-sounds-4/check.
// The console must stay clean.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import assert from 'node:assert/strict';
import { checkPicker } from '../../picker-check.mjs';
import { SOUNDS, ALL, VIEWS, DEFAULT_SOUND, LENGTHS, TARGET_LUFS, PEAK_CEIL, TAIL_CEIL } from './synth.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, '../../../../web/package.json'));
const { chromium } = require('playwright');
const round = '2026-11-21-attention-sounds-4';
const args = process.argv.slice(2);
const quick = args.includes('--quick');
const [input, outArg] = args.filter(a => !a.startsWith('--'));
if (!input) { console.error('usage: node check.mjs <page.html> [out-dir] [--quick]'); process.exit(2); }
const out = resolve(outArg ?? '/var/tmp/agent-keep/attention-sounds-4/check');
mkdirSync(out, { recursive: true });

execFileSync(process.execPath, [join(here, 'render.mjs')], { stdio: ['ignore', 'ignore', 'inherit'] });
let checks = 1; const errors = [];
const ok = (v, m) => { assert.ok(v, m); checks++; };
const eq = (a, b, m) => { assert.equal(a, b, m); checks++; };
const near = (a, b, tol, m) => { assert.ok(Math.abs(a - b) <= tol, `${m}: ${a} vs ${b}`); checks++; };

for (const f of readdirSync(here)) {
  ok(!['.wav', '.mp3', '.ogg', '.opus', '.flac', '.png', '.jpg', '.jpeg', '.html'].includes(extname(f).toLowerCase()), `${f}: no audio, image or HTML in the round`);
  ok(statSync(join(here, f)).size <= 100 * 1024, `${f}: under 100 KB`);
}

const browser = await chromium.launch(process.env.PROTO_CHROMIUM ? { executablePath: process.env.PROTO_CHROMIUM } : {});
async function open(width, theme) {
  const phone = width === 390;
  const page = await browser.newPage({ viewport: { width, height: phone ? 844 : 1000 }, deviceScaleFactor: 2, hasTouch: phone });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + resolve(input) + `?theme=${theme}`);
  await page.locator('.as-sound').first().waitFor();
  return page;
}
const pick = async (page, d) => {
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.as-views li[data-view="${VIEWS[d].id}"][aria-current]`).waitFor();
  await page.waitForTimeout(150);
};
const fits = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const inked = page => page.locator('[data-wave]').evaluateAll(cs => cs.map(c => {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n;
}));
const kept = SOUNDS.filter(s => !s.redone), redone = SOUNDS.filter(s => s.redone);

try {
  for (const width of quick ? [1280] : [1280, 390]) for (const theme of quick ? ['light'] : ['light', 'dark', 'contrast']) {
    const tag = `${width}-${theme}`;
    const page = await open(width, theme);
    await checkPicker(page, round);
    eq(await page.evaluate(() => document.documentElement.dataset.theme), theme, `${tag}: theme applied`);
    eq(await page.getByTestId('recommendation').count(), 1, `${tag}: default named on the page`);
    eq(await page.locator('.as-views li').count(), VIEWS.length, `${tag}: one line per view`);
    for (let d = 0; d < VIEWS.length; d++) {
      await pick(page, d);
      const at = `${VIEWS[d].name} ${tag}`;
      if (VIEWS[d].id !== 'C') {
        const want = VIEWS[d].id === 'A' ? kept : redone;
        eq(await page.locator('.as-sound').count(), want.length, `${at}: one card per sound`);
        eq(await page.locator('.as-wave-before').count(), want.length, `${at}: a round 4 wave on every card`);
        eq(await page.locator('.as-sound [data-wave]').count(), want.length * 3, `${at}: round 4, short and long waves`);
        assert.deepEqual(await page.locator('.as-id').allTextContents(), want.map(s => s.id), `${at}: stable ids`); checks++;
      } else {
        eq(await page.locator('.as-row').count(), SOUNDS.length, `${at}: every offered sound listed`);
        eq(await page.locator('.as-row[data-recommended]').count(), 1, `${at}: default marked once`);
        eq(await page.locator(`.as-row[data-recommended][data-sound="${DEFAULT_SOUND}"]`).count(), 1, `${at}: the default is ${DEFAULT_SOUND}`);
      }
      for (const n of await inked(page)) ok(n > 30, `${at}: waveform drawn`);
      ok(await fits(page), `${at}: no horizontal overflow`);
      await page.screenshot({ path: `${out}/${d + 1}-${VIEWS[d].id}-${tag}.png`, fullPage: true });
    }
    await page.close();
  }

  const page = await open(1280, 'light');
  ok((await page.locator('#audio-state').textContent()).includes('odottaa'), 'audio waits for a gesture');
  for (const s of ALL) {
    const full = await page.evaluate(id => window.renderOffline(id, 100), s.key);
    const [lo, hi] = s.reference ? [0.25, 1.6] : LENGTHS[s.length];
    ok(full.length >= lo - 1e-9 && full.length <= hi + 1e-9 && full.duration <= hi + 1e-9 && full.duration > 0.25, `${s.key}: offline length ${full.length}, audible ${full.duration}`);
    near(full.lufs, TARGET_LUFS, s.reference ? 1 : 0.5, `${s.key}: offline loudness at 100 %`);
    ok(full.peak <= PEAK_CEIL + 1e-3, `${s.key}: offline peak ${full.peak} under the ceiling`);
    ok(full.first < 1e-4, `${s.key}: no onset click`);
    if (!s.reference) ok(full.tail < TAIL_CEIL, `${s.key}: last 50 ms ${full.tail} under −50 dBFS`);
    const half = await page.evaluate(id => window.renderOffline(id, 50), s.key);
    near(half.peak, full.peak * 0.25, 0.002, `${s.key}: 50 % is a quarter of the gain`);
    eq((await page.evaluate(id => window.renderOffline(id, 100, true), s.key)).peak, 0, `${s.key}: muted renders silence`);
  }
  const log = () => page.evaluate(() => window.__soundLog);
  const since = async (n) => (await log()).slice(n).filter(e => e.started);
  const D = DEFAULT_SOUND;
  await pick(page, 0);
  await page.locator(`.as-sound [data-play="${D}/short"]`).click();
  ok((await page.locator('#audio-state').textContent()).includes('käytössä'), 'the click unlocked audio');
  let last = (await log()).at(-1);
  ok(last.started && last.id === `${D}/short`, 'Lyhyt plays the short length');
  eq(last.gain, 0.49, 'default volume 70 % is gain 0.49');
  await page.locator(`.as-sound [data-play="${D}/long"]`).click();
  ok((await log()).at(-1).id === `${D}/long`, 'Pitkä plays the long length');
  await page.locator(`.as-sound [data-play="r4-${D}"]`).click();
  ok((await log()).at(-1).id === `r4-${D}`, 'Kierros 4 plays round 4');
  let n = (await log()).length;
  await page.locator(`[data-ab="${D}"]`).click();
  assert.deepEqual((await since(n)).map(e => e.id), [`r4-${D}`, `${D}/short`, `${D}/long`], 'Vertaa plays round 4, short, long'); checks++;
  n = (await log()).length;
  await page.locator(`[data-day="${D}"]`).click();
  assert.deepEqual((await since(n)).map(e => e.id), Array(4).fill(`${D}/short`), 'Neljästi repeats the chosen length (short)'); checks++;
  n = (await log()).length;
  await page.locator('[data-all="A"]').click();
  assert.deepEqual((await since(n)).map(e => e.id), kept.map(s => `${s.id}/short`), 'Soita kaikki plays every kept sound, short'); checks++;
  await page.locator('[data-length="long"]').click();
  eq(await page.locator('[data-length="long"]').getAttribute('aria-pressed'), 'true', 'Pitkä toggle pressed');
  n = (await log()).length;
  await page.locator(`[data-day="${D}"]`).click();
  assert.deepEqual((await since(n)).map(e => e.id), Array(4).fill(`${D}/long`), 'Neljästi follows the toggle (long)'); checks++;
  await pick(page, 1);
  n = (await log()).length;
  await page.locator('[data-all="B"]').click();
  assert.deepEqual((await since(n)).map(e => e.id), redone.map(s => `${s.id}/long`), 'Soita kaikki plays every redone sound, long'); checks++;
  await pick(page, 2);
  eq(await page.locator(`.as-row[data-sound="${D}"] [data-play]`).getAttribute('data-play'), `${D}/long`, 'set row plays the chosen length');
  n = (await log()).length;
  await page.locator('[data-all="C"]').click();
  eq((await since(n)).length, SOUNDS.length, 'Soita kaikki plays the whole set');
  await page.locator('[data-length="short"]').click();
  eq(await page.locator(`.as-row[data-sound="${D}"] [data-play]`).getAttribute('data-play'), `${D}/short`, 'toggle back to short');
  await page.locator('#volume').fill('30');
  await page.locator('.as-row [data-play]').first().click();
  near((await log()).at(-1).gain, 0.09, 1e-6, 'volume 30 % is gain 0.09');
  await page.locator('#muted').check();
  await page.locator('.as-row [data-play]').first().click();
  ok(!(await log()).at(-1).started, 'muted: nothing starts');
  await page.close();
} finally { await browser.close(); }
assert.deepEqual(errors, [], 'console errors');
console.log(`${checks} checks passed; screenshots in ${out}`);
