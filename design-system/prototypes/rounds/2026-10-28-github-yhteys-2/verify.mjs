// Builds round 2 into its issue and checks it offline. Every variant (three directions and
// Nykyinen) in Keskustelu, Uusi työtila and Koodipalvelut for each situation, settled (at=end)
// and during the host's own attempt (at=<simulated seconds>): where the warning appears, that
// the attempt is silent in direction 1 and visible in 2 and 3, that a short outage leaves no
// warning, that a long one clears by itself when GitHub returns, and that reconnecting removes
// it. Screenshots at device scale factor 2, kept as AVIF (ImageMagick `convert`), desktop 1280 and phone 390, dark and light. No
// console errors or network requests; the picker passes picker-check.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-10-28-github-yhteys-2/verify.mjs
// A worktree without web/node_modules can point OH_WEB_PACKAGE at another checkout's web/package.json.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkPicker } from '../../picker-check.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const require = createRequire(process.env.OH_WEB_PACKAGE ?? path.join(root, 'web/package.json'));
const { chromium } = require('@playwright/test');

const dir = path.join(root, 'issues/proto-github-connection-warning/prototypes/github-connection-2');
const file = path.join(dir, 'index.html');
const out = path.join(dir, 'evidence');
execFileSync('node', [path.join(here, 'build.mjs'), '--out', file], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });

const NAMES = ['1-hiljaa', '2-nakyva', '3-otsake', 'nykyinen'];
const VIEWS = ['koti', 'klooni', 'koodi'];
const CAUSES = ['blip', 'outage', 'exp', 'disc', 'org', 'ok'];
const HEIGHTS = { 1280: 800, 390: 844 };
const THEME = { dark: 'tumma', light: 'vaalea' };
const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [], requests = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
const url = (v, o) => pathToFileURL(file).href + '?' + new URLSearchParams({ v: v + 1, bare: '1', ...o });
// PNG goes to scratch; only the AVIF is kept, so the evidence stays small in git.
const scratch = mkdtempSync(path.join(os.tmpdir(), 'github-yhteys-2-'));
async function shot(name) {
  const png = path.join(scratch, name + '.png');
  await page.screenshot({ path: png });
  execFileSync('convert', [png, '-quality', '60', path.join(out, name + '.avif')]);
}
const count = sel => page.locator('#frame ' + sel).count();

async function open(v, o) {
  await page.setViewportSize({ width: +o.w, height: HEIGHTS[o.w] });
  await page.goto(url(v, o));
  await page.waitForFunction(() => document.querySelector('#frame .app'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300); // entrance animations settle
}

// Settled: where the warning sits, per variant, view and situation.
let cases = 0;
for (let v = 0; v < 4; v++) for (const n of VIEWS) for (const c of CAUSES) {
  await open(v, { n, c, w: '1280', t: 'dark', at: 'end' });
  const failing = c === 'outage' || c === 'exp' || c === 'disc' || c === 'org';
  const tag = `${NAMES[v]} ${n} ${c}`;
  const banner = await count('[data-testid="gh-banner"]');
  if (v === 3) {
    assert.equal(banner + await count('[data-testid="c-notice"]') + await count('[data-testid="gh-chip"]'), 0, `${tag}: nothing in Nykyinen`);
    if (n === 'klooni') assert.equal(await count('[data-testid="now-failed"]'), c === 'outage' || c === 'exp' || c === 'disc' ? 1 : 0, `${tag}: production words`);
  } else if (n === 'koti') {
    assert.equal(banner, v === 0 && failing ? 1 : 0, `${tag}: banner`);
    assert.equal(await count('[data-testid="c-notice"]'), v === 1 && failing ? 1 : 0, `${tag}: composer notice`);
    assert.equal(await count('[data-testid="gh-chip"]'), v === 2 && failing ? 1 : 0, `${tag}: header chip`);
    assert.equal(await count('[data-testid="host-note"]'), v === 2 && failing ? 1 : 0, `${tag}: note under the command`);
  } else if (n === 'klooni') {
    assert.equal(banner, failing && c !== 'org' ? 1 : 0, `${tag}: banner`);
    assert.equal(await count('[data-testid="gh-place"]'), failing ? 1 : 0, `${tag}: notice in the list`);
  } else {
    assert.equal(banner, 0, `${tag}: Koodipalvelut says it in the row`);
  }
  if (c === 'blip' || c === 'ok') assert.equal(await count('[data-testid="gh-place"], [data-testid="c-notice"], [data-testid="host-note"]'), 0, `${tag}: no warning left`);
  cases++;
}

// During the attempt: direction 1 is silent, 2 shows it above the field, 3 in the header chip.
for (const [c, at] of [['outage', 45], ['exp', 5]]) for (let v = 0; v < 3; v++) {
  await open(v, { n: 'koti', c, w: '1280', t: 'dark', at: String(at) });
  const tag = `${NAMES[v]} ${c} at ${at}`;
  assert.equal(await count('[data-testid="gh-banner"], [data-testid="c-notice"], [data-testid="host-note"]'), 0, `${tag}: no warning yet`);
  assert.equal(await count('[data-testid="c-trying"]'), v === 1 ? 1 : 0, `${tag}: visible attempt above the field`);
  assert.equal(await count('[data-testid="gh-chip"][data-state="trying"]'), v === 2 ? 1 : 0, `${tag}: attempt in the chip`);
  cases++;
}
for (let v = 0; v < 3; v++) {
  await open(v, { n: 'klooni', c: 'outage', w: '1280', t: 'dark', at: '45' });
  assert.equal(await count('[data-testid="list-trying"]'), 1, `${NAMES[v]}: the list says it is retrying`);
  assert.equal(await count('[data-testid="gh-trying"]'), v === 1 ? 1 : 0, `${NAMES[v]}: banner shows the attempt only in 2`);
}
// A short outage: only direction 2 says anything, and only that the connection came back.
await open(1, { n: 'koti', c: 'blip', w: '1280', t: 'dark', at: '61' });
assert.equal(await count('[data-testid="c-recovered"]'), 1, 'direction 2: Yhteys palasi');

// Screenshots.
for (let v = 0; v < 4; v++) {
  for (const t of ['dark', 'light']) {
    await open(v, { n: 'koti', c: 'exp', w: '1280', t, at: 'end' }); await shot(`${NAMES[v]}-keskustelu-vanhentunut-1280-${THEME[t]}`);
    await open(v, { n: 'koti', c: 'exp', w: '390', t, at: 'end' }); await shot(`${NAMES[v]}-keskustelu-vanhentunut-puhelin-${THEME[t]}`);
  }
  await open(v, { n: 'koti', c: 'outage', w: '1280', t: 'dark', at: '45' }); await shot(`${NAMES[v]}-keskustelu-pitka-katko-yritys-1280-tumma`);
  await open(v, { n: 'koti', c: 'outage', w: '1280', t: 'light', at: 'end' }); await shot(`${NAMES[v]}-keskustelu-pitka-katko-lopussa-1280-vaalea`);
  await open(v, { n: 'koti', c: 'org', w: '1280', t: 'dark', at: 'end' }); await shot(`${NAMES[v]}-keskustelu-organisaatio-1280-tumma`);
  await open(v, { n: 'koti', c: 'disc', w: '390', t: 'dark', at: 'end' }); await shot(`${NAMES[v]}-keskustelu-ei-yhdistetty-puhelin-tumma`);
  await open(v, { n: 'klooni', c: 'outage', w: '1280', t: 'dark', at: '45' }); await shot(`${NAMES[v]}-uusi-tyotila-pitka-katko-yritys-1280-tumma`);
  await open(v, { n: 'klooni', c: 'exp', w: '1280', t: 'light', at: 'end' }); await shot(`${NAMES[v]}-uusi-tyotila-vanhentunut-1280-vaalea`);
  await open(v, { n: 'koodi', c: 'outage', w: '1280', t: 'dark', at: 'end' }); await shot(`${NAMES[v]}-koodipalvelut-pitka-katko-1280-tumma`);
}
await open(1, { n: 'koti', c: 'outage', w: '390', t: 'light', at: '45' }); await shot('2-nakyva-keskustelu-pitka-katko-yritys-puhelin-vaalea');
await open(1, { n: 'koti', c: 'blip', w: '1280', t: 'dark', at: '61' }); await shot('2-nakyva-keskustelu-lyhyt-katko-palasi-1280-tumma');
await open(2, { n: 'koti', c: 'outage', w: '390', t: 'dark', at: '45' }); await shot('3-otsake-keskustelu-pitka-katko-yritys-puhelin-tumma');

// Direction 3: the chip opens the explanation and its fix.
await open(2, { n: 'koti', c: 'exp', w: '1280', t: 'dark', at: 'end' });
await page.click('#frame [data-testid="gh-chip"]');
await page.waitForSelector('#frame [data-testid="gh-pop"]');
await page.waitForTimeout(300);
assert.equal(await count('[data-testid="gh-pop"] [data-act="fix"]'), 1, 'direction 3: popover offers the fix');
await shot('3-otsake-keskustelu-vanhentunut-avattu-1280-tumma');
await open(2, { n: 'koti', c: 'exp', w: '390', t: 'light', at: 'end' });
await page.click('#frame [data-testid="gh-chip"]');
await page.waitForSelector('#frame [data-testid="gh-pop"]');
await page.waitForTimeout(300);
await shot('3-otsake-keskustelu-vanhentunut-avattu-puhelin-vaalea');

// Reconnecting from the chat: the trip to GitHub and back removes the warning.
for (const [v, sel] of [[0, '[data-testid="gh-banner"] [data-act="fix"]'], [1, '[data-testid="c-notice"] [data-act="fix"]'], [2, '[data-testid="host-note"] [data-act="fix"]']]) {
  await open(v, { n: 'koti', c: 'exp', w: '1280', t: 'dark', at: 'end' });
  await page.click('#frame ' + sel);
  await page.waitForFunction(() => !document.querySelector('#frame [data-testid="veil"]') && !document.querySelector('#frame [data-testid="host-note"], #frame [data-testid="c-notice"], #frame [data-testid="gh-banner"]'), null, { timeout: 3000 });
  await page.waitForTimeout(300);
  if (v === 1) await shot('2-nakyva-keskustelu-yhdistetty-uudelleen-1280-tumma');
}
// The organisation's approval request.
await open(1, { n: 'koti', c: 'org', w: '1280', t: 'dark', at: 'end' });
await page.click('#frame [data-testid="c-notice"] [data-act="org"]');
await page.waitForSelector('#frame [data-testid="org-requested"]', { timeout: 3000 });

// Live timeline: a long outage settles into the warning, and clears by itself when GitHub returns.
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(pathToFileURL(file).href + '?' + new URLSearchParams({ v: '2', bare: '1', n: 'koti', c: 'outage', w: '1280', t: 'dark' }));
await page.waitForSelector('#frame [data-testid="c-trying"]', { timeout: 2000 });
await page.waitForSelector('#frame [data-testid="c-notice"]', { timeout: 10000 });
await page.evaluate(() => document.getElementById('sim-back').click());
await page.waitForSelector('#frame [data-testid="c-recovered"]', { timeout: 4000 });
await page.waitForFunction(() => !document.querySelector('#frame [data-testid="c-recovered"], #frame [data-testid="c-notice"]'), null, { timeout: 4000 });
// A short outage live: direction 1 never shows anything.
await page.goto(pathToFileURL(file).href + '?' + new URLSearchParams({ v: '1', bare: '1', n: 'koti', c: 'blip', w: '1280', t: 'dark' }));
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(500);
  assert.equal(await count('[data-testid="gh-banner"], [data-testid="gh-trying"]'), 0, 'direction 1: a short outage stays silent');
}

// Picker, with the chrome on.
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(pathToFileURL(file).href + '?v=2&n=koti&c=outage&at=45');
await page.waitForFunction(() => document.querySelector('#frame .app'));
await checkPicker(page, '2026-10-28-github-yhteys-2');
await page.keyboard.press('3');
await page.waitForTimeout(150);
await shot('sivu-ohjaimineen-1440');

await browser.close();
rmSync(scratch, { recursive: true, force: true });
assert.deepEqual(errors, [], 'console errors');
assert.deepEqual(requests, [], 'network requests');
console.log(`ok: ${cases} placement cases, evidence in ${path.relative(root, out)}`);
