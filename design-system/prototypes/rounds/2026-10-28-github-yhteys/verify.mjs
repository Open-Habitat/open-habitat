// Builds the round into its issue and checks it offline. Every variant (three directions and
// Nykyinen) in the views where GitHub is needed (Keskustelu, Uusi työtila, Lisää oletusrepo,
// Koodipalvelut) for each cause, on a 1280 px desktop and a 390 px phone, dark and light.
// Checks where the banner and the rail mark appear, that a typed owner/repo can be added
// unchecked when the connection is broken (and not in Nykyinen), that Myöhemmin moves the
// warning to the rail and that reconnecting removes it. Screenshots at device scale factor 2.
// No console errors or network requests; the picker passes picker-check.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-10-28-github-yhteys/verify.mjs
// A worktree without web/node_modules can point OH_WEB_PACKAGE at another checkout's web/package.json.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkPicker } from '../../picker-check.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const require = createRequire(process.env.OH_WEB_PACKAGE ?? path.join(root, 'web/package.json'));
const { chromium } = require('@playwright/test');

const dir = path.join(root, 'issues/proto-github-connection-warning/prototypes/github-connection');
const file = path.join(dir, 'index.html');
const out = path.join(dir, 'evidence');
execFileSync('node', [path.join(here, 'build.mjs'), '--out', file], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });

const NAMES = ['1-aina', '2-vaistyva', '3-tarvittaessa', 'nykyinen'];
const VIEWS = ['koti', 'klooni', 'oletus', 'koodi'];
const CAUSES = ['disc', 'exp', 'net', 'org', 'ok'];
const HEIGHTS = { 1280: 800, 390: 844 };
const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [], requests = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
const url = (v, o) => pathToFileURL(file).href + '?' + new URLSearchParams({ v: v + 1, bare: '1', ...o });
const shot = name => page.screenshot({ path: path.join(out, name + '.png') });
const count = sel => page.locator('#frame ' + sel).count();

async function open(v, o) {
  await page.setViewportSize({ width: +o.w, height: HEIGHTS[o.w] });
  await page.goto(url(v, o));
  await page.waitForFunction(() => document.querySelector('#frame .app'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450); // the typed name's lookup settles after 350 ms
}

// Where the global warning appears, for every variant, view and cause.
let cases = 0;
for (let v = 0; v < 4; v++) for (const n of VIEWS) for (const c of CAUSES) {
  await open(v, { n, c, w: '1280', t: 'dark' });
  const fixable = c === 'disc' || c === 'exp';
  assert.equal(await count('[data-testid="gh-banner"]'), (v === 0 || v === 1) && fixable ? 1 : 0, `${NAMES[v]} ${n} ${c}: banner`);
  assert.equal(await count('[data-testid="gh-rail"]'), v === 2 && fixable ? 1 : 0, `${NAMES[v]} ${n} ${c}: rail mark`);
  const needs = n === 'klooni' || n === 'oletus';
  if (needs && v < 3) assert.equal(await count('[data-testid="gh-place"]'), c === 'ok' ? 0 : 1, `${NAMES[v]} ${n} ${c}: notice in place`);
  if (needs && v === 3) assert.equal(await count('[data-testid="now-failed"]'), c === 'disc' || c === 'exp' || c === 'net' ? 1 : 0, `nykyinen ${n} ${c}`);
  cases++;
}

// Screenshots: Jari's case (Lisää oletusrepo, expired) and each view, both themes, desktop and phone.
for (let v = 0; v < 4; v++) {
  for (const t of ['dark', 'light']) {
    await open(v, { n: 'oletus', c: 'exp', w: '1280', t }); await shot(`${NAMES[v]}-oletusrepo-vanhentunut-1280-${t === 'dark' ? 'tumma' : 'vaalea'}`);
    await open(v, { n: 'oletus', c: 'exp', w: '390', t }); await shot(`${NAMES[v]}-oletusrepo-vanhentunut-puhelin-${t === 'dark' ? 'tumma' : 'vaalea'}`);
    await open(v, { n: 'koti', c: 'exp', w: '390', t }); await shot(`${NAMES[v]}-keskustelu-vanhentunut-puhelin-${t === 'dark' ? 'tumma' : 'vaalea'}`);
  }
  await open(v, { n: 'koti', c: 'exp', w: '1280', t: 'dark' }); await shot(`${NAMES[v]}-keskustelu-vanhentunut-1280-tumma`);
  await open(v, { n: 'klooni', c: 'disc', w: '1280', t: 'light' }); await shot(`${NAMES[v]}-uusi-tyotila-ei-yhdistetty-1280-vaalea`);
  await open(v, { n: 'klooni', c: 'net', w: '1280', t: 'dark' }); await shot(`${NAMES[v]}-uusi-tyotila-github-ei-vastaa-1280-tumma`);
  await open(v, { n: 'klooni', c: 'org', w: '1280', t: 'dark' }); await shot(`${NAMES[v]}-uusi-tyotila-organisaatio-1280-tumma`);
  await open(v, { n: 'koodi', c: 'net', w: '1280', t: 'dark' }); await shot(`${NAMES[v]}-koodipalvelut-github-ei-vastaa-1280-tumma`);
  await open(v, { n: 'koodi', c: 'org', w: '1280', t: 'light' }); await shot(`${NAMES[v]}-koodipalvelut-organisaatio-1280-vaalea`);
}

// The bug: a typed owner/repo with a broken connection. Directions offer Lisää tarkistamatta; Nykyinen cannot.
for (const v of [0, 3]) {
  await open(v, { n: 'oletus', c: 'exp', w: '1280', t: 'dark', q: 'northwind/pilot-materiaalit' });
  if (v === 3) {
    assert.equal(await count('[data-testid="lookup"][data-state="failed"]'), 1, 'nykyinen: typed name fails');
    assert.equal(await count('[data-testid="add-unverified"]'), 0, 'nykyinen: nothing to choose');
    await shot('nykyinen-oletusrepo-kirjoitettu-nimi-1280-tumma');
  } else {
    await page.click('#frame [data-testid="add-unverified"]');
    await page.waitForTimeout(100);
    assert.match(await page.locator('#frame .foot [role="status"]').textContent(), /^1 \/ 20/, 'typed name added unchecked');
    await shot('1-aina-oletusrepo-lisatty-tarkistamatta-1280-tumma');
  }
}
// Typing in the field itself runs the lookup.
await open(1, { n: 'oletus', c: 'disc', w: '390', t: 'light' });
await page.fill('#frame [data-testid="repo-search"]', 'maintainer/vanha-blogi');
await page.waitForSelector('#frame [data-testid="add-unverified"]');
await shot('2-vaistyva-oletusrepo-kirjoitettu-nimi-puhelin-vaalea');

// Direction 2: Myöhemmin moves the warning to the rail (and the phone's menu button).
await open(1, { n: 'koti', c: 'exp', w: '1280', t: 'dark' });
await page.click('#frame [data-act="later"]');
await page.waitForTimeout(250);
assert.equal(await count('[data-testid="gh-banner"]'), 0, 'direction 2: banner hidden');
assert.equal(await count('[data-testid="gh-rail"]'), 1, 'direction 2: rail mark after Myöhemmin');
await shot('2-vaistyva-myohemmin-jalkeen-1280-tumma');
await open(1, { n: 'koti', c: 'exp', w: '390', t: 'dark', dismissed: '1' });
assert.equal(await count('[data-testid="gh-badge"]'), 1, 'direction 2: phone menu badge after Myöhemmin');
await shot('2-vaistyva-myohemmin-jalkeen-puhelin-tumma');
// The rail mark opens Koodipalvelut.
await open(2, { n: 'koti', c: 'exp', w: '1280', t: 'dark' });
await page.click('#frame [data-testid="gh-rail"]');
await page.waitForSelector('#frame [data-testid="gh-row"]');
await shot('3-tarvittaessa-merkista-koodipalveluihin-1280-tumma');

// Reconnecting: the trip to GitHub and back removes the banner and shows the list.
await open(0, { n: 'klooni', c: 'exp', w: '1280', t: 'dark' });
await page.click('#frame [data-testid="gh-banner"] [data-act="fix"]');
await page.waitForSelector('#frame [data-testid="gh-ok"]', { timeout: 3000 });
assert.equal(await count('[data-testid="gh-banner"]'), 0, 'banner gone after reconnect');
assert.equal(await count('[data-testid="gh-place"]'), 0, 'notice gone after reconnect');
assert.ok(await count('[data-testid="repo-row"]') > 0, 'list shown after reconnect');
await shot('1-aina-yhdistetty-uudelleen-1280-tumma');

// Picker, with the chrome on.
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(pathToFileURL(file).href + '?v=2&n=koti&c=exp');
await page.waitForFunction(() => document.querySelector('#frame .app'));
await checkPicker(page, '2026-10-28-github-yhteys');
await page.keyboard.press('1');
await page.waitForTimeout(150);
await shot('sivu-ohjaimineen-1440');

await browser.close();
assert.deepEqual(errors, [], 'console errors');
assert.deepEqual(requests, [], 'network requests');
console.log(`ok: ${cases} placement cases, evidence in ${path.relative(root, out)}`);
