#!/usr/bin/env node
// node check.mjs <page.html> [out-dir] [--quick]
// Authored check of the built round, not a host-backed test.
//  1. render.mjs: 9 polished sounds and 4–6 new candidates with stable ids;
//     every offered sound ≤ 1.6 s, its momentary loudness at the target, peak
//     under −3 dBFS, no onset click, the last 50 ms under −50 dBFS and under
//     −45 dBFS even before the final fade (a natural decay, not a cut), under
//     −30 dB of energy above 6 kHz, stereo width; every fingerprint, including
//     round 2's "before" versions, unchanged.
//  2. The round directory holds no audio, PNG, JPEG or HTML file and no file
//     over 100 KB (the page renders the sounds from their recipes).
//  3. Headless Chromium at 1280 and 390 px in Päivä, Yö and Korkea kontrasti:
//     the shared picker, one line per view, the before/after pairs with both
//     waveforms drawn, the candidates, the whole set with the default marked
//     once, stable ids, no overflow.
//  4. Audio at 1280 Päivä: every sound through the page's own buffer and gain
//     chain in an OfflineAudioContext (duration, loudness at 100 %, peak at
//     100 % and 50 %, last 50 ms under −50 dBFS, muted silence, no onset
//     click); a click unlocks audio and starts playback; Vertaa plays round 2
//     then round 3; Neljästi and Soita kaikki schedule what they say.
// Screenshots go to out-dir, default /var/tmp/agent-keep/attention-sounds-3/check.
// The console must stay clean.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import assert from 'node:assert/strict';
import { checkPicker } from '../../picker-check.mjs';
import { SOUNDS, BEFORE, ALL, VIEWS, DEFAULT_SOUND, MAX_DUR, TARGET_LUFS, PEAK_CEIL, TAIL_CEIL } from './synth.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, '../../../../web/package.json'));
const { chromium } = require('playwright');
const round = '2026-11-21-attention-sounds-3';
const args = process.argv.slice(2);
const quick = args.includes('--quick');
const [input, outArg] = args.filter(a => !a.startsWith('--'));
if (!input) { console.error('usage: node check.mjs <page.html> [out-dir] [--quick]'); process.exit(2); }
const out = resolve(outArg ?? '/var/tmp/agent-keep/attention-sounds-3/check');
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
const pairs = SOUNDS.filter(s => s.before), fresh = SOUNDS.filter(s => s.isNew);

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
      if (VIEWS[d].id === 'A') {
        eq(await page.locator('.as-sound').count(), pairs.length, `${at}: one card per polished sound`);
        eq(await page.locator('.as-wave-before').count(), pairs.length, `${at}: a before wave on every card`);
        assert.deepEqual(await page.locator('.as-id').allTextContents(), pairs.map(s => s.id), `${at}: stable ids`); checks++;
      } else if (VIEWS[d].id === 'B') {
        eq(await page.locator('.as-sound').count(), fresh.length, `${at}: one card per candidate`);
        assert.deepEqual(await page.locator('.as-id').allTextContents(), fresh.map(s => s.id), `${at}: stable ids`); checks++;
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
    const full = await page.evaluate(id => window.renderOffline(id, 100), s.id);
    const limit = s.reference ? 1.2 : MAX_DUR;
    ok(full.length <= limit + 1e-9 && full.duration <= limit + 1e-9 && full.duration > 0.25, `${s.id}: offline duration ${full.duration}`);
    near(full.lufs, TARGET_LUFS, 1, `${s.id}: offline loudness at 100 %`);
    ok(full.peak <= PEAK_CEIL + 1e-3, `${s.id}: offline peak ${full.peak} under the ceiling`);
    ok(full.first < 1e-4, `${s.id}: no onset click`);
    if (!s.reference) ok(full.tail < TAIL_CEIL, `${s.id}: last 50 ms ${full.tail} under −50 dBFS`);
    const half = await page.evaluate(id => window.renderOffline(id, 50), s.id);
    near(half.peak, full.peak * 0.25, 0.002, `${s.id}: 50 % is a quarter of the gain`);
    eq((await page.evaluate(id => window.renderOffline(id, 100, true), s.id)).peak, 0, `${s.id}: muted renders silence`);
  }
  const log = () => page.evaluate(() => window.__soundLog);
  await pick(page, 0);
  await page.locator(`.as-sound [data-play="${DEFAULT_SOUND}"]`).click();
  ok((await page.locator('#audio-state').textContent()).includes('käytössä'), 'the click unlocked audio');
  let last = (await log()).at(-1);
  ok(last.started && last.id === DEFAULT_SOUND, 'Uusi started playback');
  eq(last.gain, 0.49, 'default volume 70 % is gain 0.49');
  await page.locator(`.as-sound [data-play="r2-${DEFAULT_SOUND}"]`).click();
  last = (await log()).at(-1);
  ok(last.started && last.id === `r2-${DEFAULT_SOUND}`, 'Kierros 2 plays the before version');
  let n = (await log()).length;
  await page.locator(`[data-ab="${DEFAULT_SOUND}"]`).click();
  assert.deepEqual((await log()).slice(n).map(e => e.id), [`r2-${DEFAULT_SOUND}`, DEFAULT_SOUND], 'Vertaa plays round 2 then round 3'); checks++;
  n = (await log()).length;
  await page.locator(`[data-day="${DEFAULT_SOUND}"]`).click();
  eq((await log()).slice(n).filter(e => e.started && e.why === 'repeat').length, 4, 'Neljästi schedules four');
  n = (await log()).length;
  await page.locator('[data-all="A"]').click();
  eq((await log()).slice(n).filter(e => e.started).length, pairs.length * 2, 'Soita kaikki plays every pair');
  await pick(page, 2);
  n = (await log()).length;
  await page.locator('[data-all="C"]').click();
  eq((await log()).slice(n).filter(e => e.started).length, SOUNDS.length, 'Soita kaikki plays the whole set');
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
