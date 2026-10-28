// Builds the round into its issue and checks it offline. Every variant (three directions and
// Nykyinen): when the card, the Luo katsaus row or nothing appears for each mode and silence;
// that a change in Settings reaches the conversation; direction 2's card link and model list
// (Fable and Opus not selectable); direction 3's card menu, its change note and Kumoa.
// Screenshots of the conversation and Settings on a 1280 px desktop and a 390 px phone, dark
// and light, at device scale factor 2, kept as AVIF (ffmpeg's libaom-av1). No console errors or network requests; the picker
// passes picker-check.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-10-28-tilannekatsaus-asetukset/verify.mjs
// A worktree without web/node_modules can point OH_WEB_PACKAGE at another checkout's web/package.json.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkPicker } from '../../picker-check.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const require = createRequire(process.env.OH_WEB_PACKAGE ?? path.join(root, 'web/package.json'));
const { chromium } = require('@playwright/test');

const dir = path.join(root, 'issues/proto-recap-settings/prototypes/recap-settings');
const file = path.join(dir, 'index.html');
const out = path.join(dir, 'evidence');
execFileSync('node', [path.join(here, 'build.mjs'), '--out', file], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });

const NAMES = ['1-tekoalyn-alla', '2-oma-osio', '3-kortista', 'nykyinen'];
const HEIGHTS = { 1280: 800, 390: 844 };
const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [], requests = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
const url = (v, o) => pathToFileURL(file).href + '?' + new URLSearchParams({ v: v + 1, bare: '1', ...o });
const theme = t => (t === 'dark' ? 'tumma' : 'vaalea');
const shot = name => page.screenshot({ path: path.join(out, name + '.png') });
const count = sel => page.locator('#frame ' + sel).count();
const click = sel => page.locator('#frame ' + sel).first().click();

async function open(v, o) {
  const w = o.w ?? '1280';
  await page.setViewportSize({ width: +w, height: HEIGHTS[w] });
  await page.goto(url(v, { n: 'keskustelu', s: '3', t: 'dark', w, ...o }));
  await page.waitForFunction(() => document.querySelector('#frame .app'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250); // entrance animations settle
}

// Where the card appears, for every variant, mode and silence (delay 3 min).
let cases = 0;
for (let v = 0; v < 4; v++) for (const m of ['auto', 'ask', 'off']) for (const s of ['1', '3', '5']) {
  await open(v, { m, s });
  const isDue = +s >= 3;
  const eff = v === 3 ? 'auto' : m; // Nykyinen has no setting
  assert.equal(await count('[data-testid="recap-card"]'), isDue && eff === 'auto' ? 1 : 0, `${NAMES[v]} ${m} ${s} min: card`);
  assert.equal(await count('[data-testid="recap-offer"]'), isDue && eff === 'ask' ? 1 : 0, `${NAMES[v]} ${m} ${s} min: offer`);
  cases++;
}
// A one-minute delay brings the card at one minute.
for (let v = 0; v < 3; v++) { await open(v, { m: 'auto', d: '1', s: '1' }); assert.equal(await count('[data-testid="recap-card"]'), 1, `${NAMES[v]} delay 1`); }

// Luo katsaus makes the card (skeleton first).
for (let v = 0; v < 3; v++) {
  await open(v, { m: 'ask' });
  await click('[data-act="request"]');
  assert.equal(await count('.ah-recap-skeleton'), 1, `${NAMES[v]}: skeleton`);
  await page.waitForTimeout(800);
  assert.equal(await count('[data-testid="recap-card"] .ah-recap-next'), 1, `${NAMES[v]}: requested card`);
}

// Where the setting lives.
for (let v = 0; v < 4; v++) {
  await open(v, { n: 'asetukset' });
  assert.equal(await count('[data-testid="background-card"]'), v === 0 || v === 2 ? 1 : 0, `${NAMES[v]}: Tekoäly › Taustatyöt`);
  assert.equal(await count('[data-testid="settings-tilannekatsaus"]'), v === 1 ? 1 : 0, `${NAMES[v]}: own section`);
  assert.equal(await count('[data-testid="model-list"]'), v === 1 ? 1 : 0, `${NAMES[v]}: model list`);
  assert.equal(await count('[data-testid="model-readonly"]'), v === 0 || v === 2 ? 1 : 0, `${NAMES[v]}: read-only model`);
}

// A change in Settings reaches the conversation; the delay is not offered when off.
for (const v of [0, 1, 2]) {
  await open(v, { n: 'asetukset' });
  await click('[data-testid="mode"] [data-v="off"]');
  assert.equal(await page.locator('#frame [data-testid="delay"]').getAttribute('aria-disabled'), 'true', `${NAMES[v]}: delay disabled when off`);
  await click('[data-testid="mode"] [data-v="ask"]');
  await click('.rail-item.sub[data-to="keskustelu"]');
  await page.waitForTimeout(250);
  assert.equal(await count('[data-testid="recap-offer"]'), 1, `${NAMES[v]}: setting reached the conversation`);
}

// Direction 2: Fable and Opus cannot be chosen; a chosen model shows in the preview; the card's gear lands on the setting.
await open(1, { n: 'asetukset' });
assert.equal(await page.locator('#frame [data-testid="model-claude-fable-5-1"]').getAttribute('aria-disabled'), 'true');
assert.equal(await page.locator('#frame [data-testid="model-claude-opus-5-5"]').getAttribute('aria-disabled'), 'true');
await page.locator('#frame [data-testid="model-claude-fable-5-1"]').click({ force: true });
assert.equal(await page.locator('#frame [data-testid="model-auto"]').getAttribute('aria-checked'), 'true', 'Fable click ignored');
await click('[data-testid="model-gpt-6-luna"]');
assert.match(await page.locator('#frame [data-testid="recap-preview"]').innerText(), /GPT-6 Luna/);
await shot('2-oma-osio-asetukset-luna-valittu-1280-tumma');
await open(1, {});
await click('[data-testid="card-settings"]');
await page.waitForTimeout(200);
assert.equal(await count('[data-settings-row="tilannekatsaus"][data-landed]'), 1, 'd2 gear lands on the row');
await shot('2-oma-osio-kortista-asetuksiin-1280-tumma');

// Direction 3: the card's menu changes the setting where it shows, with Kumoa.
await open(2, {});
await click('[data-testid="card-menu"]');
assert.equal(await count('[data-testid="recap-menu"]'), 1, 'd3 menu');
await page.waitForTimeout(250);
await shot('3-kortista-valikko-auki-1280-tumma');
await page.keyboard.press('Escape');
assert.equal(await count('[data-testid="recap-menu"]'), 0, 'd3 menu closes on Escape');
await click('[data-testid="card-menu"]');
await click('[data-act="menu-set"][data-v="ask"]');
assert.equal(await count('[data-testid="recap-note"]'), 1, 'd3 note');
await page.waitForTimeout(250);
assert.equal(await count('[data-testid="recap-card"]'), 0, 'd3 card gone');
await shot('3-kortista-vain-kun-pyydan-ilmoitus-1280-tumma');
await click('[data-act="undo"]');
assert.equal(await count('[data-testid="recap-card"]'), 1, 'd3 undo restores');
await click('[data-testid="card-menu"]');
await click('[data-act="menu-set"][data-k="d"][data-v="5"]');
await click('.rail-account');
await page.waitForTimeout(150);
assert.equal(await page.locator('#frame [data-testid="delay"] [aria-checked="true"]').innerText(), '5 min', 'd3 menu delay reaches Settings');
await open(2, { w: '390', t: 'light' });
await click('[data-testid="card-menu"]');
await page.waitForTimeout(250);
await shot('3-kortista-valikko-auki-puhelin-vaalea');

// Screenshots: conversation and Settings, each variant, both themes, desktop and phone.
for (let v = 0; v < 4; v++) {
  for (const t of ['dark', 'light']) {
    for (const w of ['1280', '390']) {
      const wn = w === '390' ? 'puhelin' : '1280';
      await open(v, { t, w });
      await shot(`${NAMES[v]}-keskustelu-kortti-${wn}-${theme(t)}`);
      await open(v, { t, w, n: 'asetukset' });
      // On the phone the section is long; bring the round's rows into view.
      if (w === '390') await page.evaluate(() => (document.querySelector('#frame [data-testid="background-card"]') ?? document.querySelector('#frame [data-testid="settings-main"] h2'))?.scrollIntoView({ block: 'start' }));
      await shot(`${NAMES[v]}-asetukset-${wn}-${theme(t)}`);
    }
  }
}
for (let v = 0; v < 3; v++) {
  await open(v, { m: 'ask' }); await shot(`${NAMES[v]}-keskustelu-kun-pyydan-1280-tumma`);
  await open(v, { m: 'ask', w: '390', t: 'light' }); await shot(`${NAMES[v]}-keskustelu-kun-pyydan-puhelin-vaalea`);
}
await open(0, { n: 'asetukset', m: 'off', t: 'light' }); await shot('1-tekoalyn-alla-asetukset-pois-1280-vaalea');

// Picker and console.
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(pathToFileURL(file).href);
await page.waitForFunction(() => document.querySelector('#frame .app'));
await checkPicker(page, '2026-10-28-tilannekatsaus-asetukset');
for (const key of ['2', '3', '4', '1']) { await page.keyboard.press(key); await page.waitForTimeout(80); }
assert.equal(await page.locator('.proto-picker-item[data-active]').innerText(), '1 Tekoälyn alla');

await browser.close();
// The issue keeps AVIF, not PNG (issuectl doctor); Playwright writes only PNG.
for (const png of readdirSync(out).filter(f => f.endsWith('.png'))) {
  const src = path.join(out, png);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-c:v', 'libaom-av1', '-still-picture', '1', '-crf', '28', '-cpu-used', '6', '-pix_fmt', 'yuv444p', src.replace(/\.png$/, '.avif')]);
  rmSync(src);
}
assert.deepEqual(errors, [], 'console errors');
assert.deepEqual(requests, [], 'network requests');
console.log(`ok: ${cases} placement cases, interactions and screenshots in ${path.relative(root, out)}`);
