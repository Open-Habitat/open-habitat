#!/usr/bin/env node
// node check.mjs <page.html> [out-dir] [--quick]
// Authored check of the built round, not a host-backed test.
//  1. render.mjs: every recipe under 1 s, peak on target, no onset click, a
//     silent tail, WAV under 100 KB, fingerprints unchanged.
//  2. Headless Chromium at 1280 and 390 px in Päivä, Yö and Korkea kontrasti:
//     the shared picker, the recommendation and the three family lines, each
//     family's cards with drawn waveforms, the chosen family marked, no overflow.
//  3. Audio at 1280 Päivä: each sound rendered through the page's own buffer
//     and gain chain in an OfflineAudioContext (duration, peak at 100 %, 50 %
//     and muted); a Soita click starts real playback after the gesture.
//  4. The simulated rail: reply, question, worker-held turn, the agent's own
//     sections, a burst of three, looking at the conversation, a hidden tab,
//     mute, volume, reduced motion and the locked-audio notice, each with
//     the sound/no-sound outcome the rules give.
// Screenshots (<n>-<family>-<width>-<theme>.png and sim-*.png) go to out-dir,
// default /var/tmp/agent-keep/attention-sounds/check. Console must stay clean.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { checkPicker } from '../../picker-check.mjs';
import { SOUNDS, FAMILIES, PEAK } from './synth.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, '../../../../web/package.json'));
const { chromium } = require('playwright');
const round = '2026-11-17-attention-sounds';
const args = process.argv.slice(2);
const quick = args.includes('--quick');
const [input, outArg] = args.filter(a => !a.startsWith('--'));
if (!input) { console.error('usage: node check.mjs <page.html> [out-dir] [--quick]'); process.exit(2); }
const out = resolve(outArg ?? '/var/tmp/agent-keep/attention-sounds/check');
mkdirSync(out, { recursive: true });

execFileSync(process.execPath, [join(here, 'render.mjs')], { stdio: ['ignore', 'ignore', 'inherit'] });
let checks = 1; const errors = [];
const ok = (v, m) => { assert.ok(v, m); checks++; };
const eq = (a, b, m) => { assert.equal(a, b, m); checks++; };
const near = (a, b, tol, m) => { assert.ok(Math.abs(a - b) <= tol, `${m}: ${a} vs ${b}`); checks++; };

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
  await page.locator(`.as-sound[data-sound^="${FAMILIES[d].id.toLowerCase()}"]`).first().waitFor();
  await page.waitForTimeout(120);
};
const fits = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const inked = page => page.locator('.as-wave').first().evaluate(c => {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n;
});

try {
  for (const width of quick ? [1280] : [1280, 390]) for (const theme of quick ? ['light'] : ['light', 'dark', 'contrast']) {
    const tag = `${width}-${theme}`;
    const page = await open(width, theme);
    await checkPicker(page, round);
    eq(await page.evaluate(() => document.documentElement.dataset.theme), theme, `${tag}: theme applied`);
    eq(await page.getByTestId('recommendation').count(), 1, `${tag}: recommendation on the page`);
    eq(await page.locator('.as-families li').count(), 3, `${tag}: one line per family`);
    for (let d = 0; d < FAMILIES.length; d++) {
      await pick(page, d);
      const at = `${FAMILIES[d].name} ${tag}`;
      eq(await page.locator('.as-sound').count(), SOUNDS.filter(s => s.family === FAMILIES[d].id).length, `${at}: cards`);
      eq(await page.locator('.as-sound[data-recommended]').count(), FAMILIES[d].id === 'C' ? 1 : 0, `${at}: recommended card only in C`);
      ok(await inked(page) > 50, `${at}: waveform drawn`);
      ok(await fits(page), `${at}: no horizontal overflow`);
      await page.screenshot({ path: `${out}/${d + 1}-${FAMILIES[d].id}-${tag}.png`, fullPage: true });
    }
    await page.close();
  }

  const page = await open(1280, 'light');
  // Nothing has been clicked yet: audio waits for the first gesture.
  ok((await page.locator('#audio-state').textContent()).includes('odottaa'), 'audio waits for a gesture');
  for (const s of SOUNDS) {
    const full = await page.evaluate(id => window.renderOffline(id, 100), s.id);
    near(full.peak, PEAK * (s.level ?? 1), 0.005, `${s.id}: offline peak at 100 %`);
    ok(full.length < 1 && full.duration < 1 && full.duration > 0.15, `${s.id}: offline duration ${full.duration}`);
    const half = await page.evaluate(id => window.renderOffline(id, 50), s.id);
    near(half.peak, PEAK * (s.level ?? 1) * 0.25, 0.003, `${s.id}: 50 % is a quarter of the gain`);
    eq((await page.evaluate(id => window.renderOffline(id, 100, true), s.id)).peak, 0, `${s.id}: muted renders silence`);
  }
  await pick(page, 2);
  await page.locator('[data-play="c1"]').click();
  ok((await page.locator('#audio-state').textContent()).includes('käytössä'), 'the click unlocked audio');
  const last = () => page.evaluate(() => window.__soundLog.at(-1));
  ok((await last()).started, 'Soita started playback');
  eq((await last()).gain, 0.49, 'default volume 70 % is gain 0.49');

  const ev = (name) => page.getByTestId(`event-${name}`).click();
  const reset = () => ev('reset');
  const outcomes = () => page.locator('[data-testid="sound-log"] li[data-outcome]').evaluateAll(l => l.map(x => x.dataset.outcome).reverse());
  const section = (id) => page.locator(`[data-testid^="rail-"]:has([data-testid="row-${id}"])`).getAttribute('data-testid');
  const where = (v) => page.locator(`input[name="where"][value="${v}"]`).check();
  const shot = (n) => page.locator('.as-sim').screenshot({ path: `${out}/sim-${n}.png` });

  await reset(); await ev('reply');
  eq(await section('cleanup'), 'rail-yours', 'reply: to Sinun vuorosi');
  assert.deepEqual(await outcomes(), ['played'], 'reply sounds'); checks++;
  await reset(); await ev('ask');
  eq(await section('release'), 'rail-yours', 'question: to Sinun vuorosi');
  assert.deepEqual(await outcomes(), ['played'], 'question sounds'); checks++;
  await reset(); await ev('turn-worker');
  eq(await section('tiles'), 'rail-running', 'turn with a worker running stays in Käynnissä');
  await ev('worker-done');
  eq(await section('tiles'), 'rail-yours', 'worker done: reply claims the turn');
  assert.deepEqual(await outcomes(), ['silent', 'played'], 'held turn silent, worker-free end sounds'); checks++;
  await reset(); await ev('self-running'); await ev('self-quiet');
  eq(await section('notes'), 'rail-quiet', 'agent placed itself in Hiljaiset');
  assert.deepEqual(await outcomes(), ['silent', 'silent'], "agent's own sections are silent"); checks++;
  await reset(); await ev('burst'); await page.waitForTimeout(1200);
  for (const id of ['tests', 'deps', 'strings']) eq(await section(id), 'rail-yours', `burst: ${id} waits`);
  assert.deepEqual(await outcomes(), ['played', 'merged', 'merged'], 'burst: one sound'); checks++;
  eq((await page.evaluate(() => window.__soundLog.filter(e => /^(tests|deps|strings)$/.test(e.why)).length)), 1, 'burst: one playback');
  await shot('burst');

  await reset(); await where('this'); await ev('reply');
  assert.deepEqual(await outcomes(), ['silent'], 'looking at the conversation: silent'); checks++;
  eq(await page.locator('[data-testid="row-cleanup"][aria-current]').count(), 1, 'looking: that row is open');
  await reset(); await ev('burst'); await page.waitForTimeout(1200);
  assert.deepEqual(await outcomes(), ['silent', 'played', 'merged'], 'looking at one of three: the others sound once'); checks++;
  await reset(); await where('hidden'); await ev('reply');
  assert.deepEqual(await outcomes(), ['played'], 'hidden tab sounds'); checks++;
  ok((await page.getByTestId('tab-title').textContent()).includes('Agentti tarvitsee huomiota'), 'hidden tab title asks for attention');
  await shot('hidden');
  await where('other');

  await reset(); await page.locator('#muted').check(); await ev('reply');
  assert.deepEqual(await outcomes(), ['silent'], 'muted: silent'); checks++;
  await page.locator('#muted').uncheck();
  await reset(); await page.locator('#volume').fill('30'); await ev('reply');
  near((await last()).gain, 0.09, 1e-6, 'volume 30 % is gain 0.09');
  await page.locator('#volume').fill('70');

  await reset(); await page.locator('#reduced').check(); await ev('reply');
  assert.deepEqual(await outcomes(), ['played'], 'reduced motion still sounds'); checks++;
  eq(await page.locator('[data-testid="row-cleanup"]').evaluate(el => getComputedStyle(el).animationName), 'none', 'reduced motion: no arrival animation');
  await page.locator('#reduced').uncheck();

  await reset(); await page.locator('#locked').check(); await ev('reply');
  assert.deepEqual(await outcomes(), ['blocked'], 'locked: blocked, not lost'); checks++;
  ok(await page.getByTestId('unlock-notice').isVisible(), 'locked: the rail says so');
  await shot('locked');
  await page.getByTestId('unlock').click();
  eq(await page.getByTestId('unlock-notice').count(), 0, 'unlock: notice gone');
  ok((await last()).started && (await last()).why === 'unlock', 'unlock: confirmation plays');
  await page.close();

  const phone = await open(390, 'dark');
  await pick(phone, 2);
  await phone.getByTestId('event-burst').click(); await phone.waitForTimeout(1200);
  ok(await fits(phone), 'phone: simulation fits');
  await phone.locator('.as-sim').screenshot({ path: `${out}/sim-390-dark.png` });
  await phone.close();
} finally { await browser.close(); }
assert.deepEqual(errors, [], 'console errors');
console.log(`${checks} checks passed; screenshots in ${out}`);
