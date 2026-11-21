#!/usr/bin/env node
// node check.mjs <page.html> [out-dir] [--quick]
// Authored check of the built round, not a host-backed test.
//  1. render.mjs: 16–24 new sounds with stable ids, every sound ≤ 1.2 s, its
//     momentary loudness at the target, peak under −3 dBFS, no onset click,
//     a silent tail, under −30 dB of energy above 6 kHz, stereo width,
//     fingerprints unchanged.
//  2. The round directory holds no audio, PNG, JPEG or HTML file and no file
//     over 100 KB (the page renders the sounds from their recipes).
//  3. Headless Chromium at 1280 and 390 px in Päivä, Yö and Korkea kontrasti:
//     the shared picker, the recommendation and shortlist, one line per
//     family, each family's cards with drawn waveforms and stable ids, no
//     overflow.
//  4. Audio at 1280 Päivä: every sound through the page's own buffer and gain
//     chain in an OfflineAudioContext (duration ≤ 1.2 s, loudness on target at
//     100 %, peak at 100 % and 50 %, muted silence, no onset click); a Soita
//     click unlocks audio and starts playback; Neljästi, Ovi ensin and
//     Soita kaikki schedule what they say.
// Screenshots go to out-dir, default /var/tmp/agent-keep/attention-sounds-2/check.
// The console must stay clean.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import assert from 'node:assert/strict';
import { checkPicker } from '../../picker-check.mjs';
import { SOUNDS, FAMILIES, RECOMMENDED, MAX_DUR, TARGET_LUFS, PEAK_CEIL } from './synth.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, '../../../../web/package.json'));
const { chromium } = require('playwright');
const round = '2026-11-21-attention-sounds-2';
const args = process.argv.slice(2);
const quick = args.includes('--quick');
const [input, outArg] = args.filter(a => !a.startsWith('--'));
if (!input) { console.error('usage: node check.mjs <page.html> [out-dir] [--quick]'); process.exit(2); }
const out = resolve(outArg ?? '/var/tmp/agent-keep/attention-sounds-2/check');
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
  await page.locator(`.as-families li[data-family="${FAMILIES[d].id}"][aria-current]`).waitFor();
  await page.waitForTimeout(150);
};
const fits = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const inked = page => page.locator('.as-wave').evaluateAll(cs => cs.map(c => {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n;
}));

try {
  for (const width of quick ? [1280] : [1280, 390]) for (const theme of quick ? ['light'] : ['light', 'dark', 'contrast']) {
    const tag = `${width}-${theme}`;
    const page = await open(width, theme);
    await checkPicker(page, round);
    eq(await page.evaluate(() => document.documentElement.dataset.theme), theme, `${tag}: theme applied`);
    eq(await page.getByTestId('recommendation').count(), 1, `${tag}: recommendation on the page`);
    eq(await page.locator('[data-testid="shortlist"] [data-play]').count(), RECOMMENDED.shortlist.length, `${tag}: shortlist`);
    eq(await page.locator('.as-families li').count(), FAMILIES.length, `${tag}: one line per family`);
    for (let d = 0; d < FAMILIES.length; d++) {
      await pick(page, d);
      const at = `${FAMILIES[d].name} ${tag}`;
      const list = SOUNDS.filter(s => s.family === FAMILIES[d].id);
      eq(await page.locator('.as-sound').count(), list.length, `${at}: cards`);
      assert.deepEqual(await page.locator('.as-id').allTextContents(), list.map(s => s.id), `${at}: stable ids shown`); checks++;
      eq(await page.locator('.as-sound[data-recommended]').count(), list.some(s => s.id === RECOMMENDED.sound) ? 1 : 0, `${at}: default marked once`);
      for (const n of await inked(page)) ok(n > 50, `${at}: waveform drawn`);
      ok(await fits(page), `${at}: no horizontal overflow`);
      await page.screenshot({ path: `${out}/${d + 1}-${FAMILIES[d].id}-${tag}.png`, fullPage: true });
    }
    await page.close();
  }

  const page = await open(1280, 'light');
  ok((await page.locator('#audio-state').textContent()).includes('odottaa'), 'audio waits for a gesture');
  for (const s of SOUNDS) {
    const full = await page.evaluate(id => window.renderOffline(id, 100), s.id);
    ok(full.length <= MAX_DUR + 1e-9 && full.duration <= MAX_DUR + 1e-9 && full.duration > 0.25, `${s.id}: offline duration ${full.duration}`);
    near(full.lufs, TARGET_LUFS, 1, `${s.id}: offline loudness at 100 %`);
    ok(full.peak <= PEAK_CEIL + 1e-3, `${s.id}: offline peak ${full.peak} under the ceiling`);
    ok(full.first < 1e-4, `${s.id}: no onset click`);
    const half = await page.evaluate(id => window.renderOffline(id, 50), s.id);
    near(half.peak, full.peak * 0.25, 0.002, `${s.id}: 50 % is a quarter of the gain`);
    eq((await page.evaluate(id => window.renderOffline(id, 100, true), s.id)).peak, 0, `${s.id}: muted renders silence`);
  }
  const log = () => page.evaluate(() => window.__soundLog);
  const reco = SOUNDS.find(s => s.id === RECOMMENDED.sound);
  await pick(page, FAMILIES.findIndex(f => f.id === reco.family));
  await page.locator(`.as-sound [data-play="${reco.id}"]`).click();
  ok((await page.locator('#audio-state').textContent()).includes('käytössä'), 'the click unlocked audio');
  const last = (await log()).at(-1);
  ok(last.started && last.id === reco.id, 'Soita started playback');
  eq(last.gain, 0.49, 'default volume 70 % is gain 0.49');
  let n = (await log()).length;
  await page.locator(`[data-day="${reco.id}"]`).click();
  eq((await log()).slice(n).filter(e => e.started && e.why === 'repeat').length, 4, 'Neljästi schedules four');
  n = (await log()).length;
  await page.locator(`[data-ab="${reco.id}"]`).click();
  assert.deepEqual((await log()).slice(n).map(e => e.id), ['r1-ovi', reco.id], 'Ovi ensin plays Ovi then the sound'); checks++;
  await pick(page, 0);
  n = (await log()).length;
  await page.locator('[data-all="A"]').click();
  eq((await log()).slice(n).filter(e => e.started).length, SOUNDS.filter(s => s.family === 'A').length, 'Soita kaikki plays the family');
  await page.locator('#volume').fill('30');
  await page.locator('[data-testid="shortlist"] [data-play]').first().click();
  near((await log()).at(-1).gain, 0.09, 1e-6, 'volume 30 % is gain 0.09');
  await page.locator('#muted').check();
  await page.locator('[data-testid="shortlist"] [data-play]').first().click();
  ok(!(await log()).at(-1).started, 'muted: nothing starts');
  await page.close();
} finally { await browser.close(); }
assert.deepEqual(errors, [], 'console errors');
console.log(`${checks} checks passed; screenshots in ${out}`);
