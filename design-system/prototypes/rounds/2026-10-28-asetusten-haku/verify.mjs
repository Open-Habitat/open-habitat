// Builds the round into its issue and checks it offline: for each direction, what a search
// finds (a setting by name, by synonym, inside a Finnish compound, nothing), how the results
// show, and that choosing one opens its section with the row marked; Escape clears the search
// and then closes Settings; the X returns to the conversation; admin rows only for an admin.
// Screenshots on a 1280 px desktop and a 390 px phone, dark and light, at device scale factor 2,
// kept as AVIF (ffmpeg's libaom-av1). No console errors or network requests; the picker passes
// picker-check.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-10-28-asetusten-haku/verify.mjs
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

const dir = path.join(root, 'issues/proto-settings-search/prototypes/settings-search');
const file = path.join(dir, 'index.html');
const out = path.join(dir, 'evidence');
execFileSync('node', [path.join(here, 'build.mjs'), '--out', file], { stdio: 'inherit' });
mkdirSync(out, { recursive: true });
// Earlier shots are replaced one file at a time, never by removing the directory.
for (const f of readdirSync(out).filter(f => /\.(png|avif)$/.test(f))) rmSync(path.join(out, f));

const NAMES = ['1-sivupalkissa', '2-tulossivu', '3-pikahaku', 'nykyinen'];
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
const loc = sel => page.locator('#frame ' + sel);
const count = sel => loc(sel).count();
const field = () => loc('[data-testid="settings-search"]').last();

async function open(v, o = {}) {
  const w = o.w ?? '1280';
  await page.setViewportSize({ width: +w, height: HEIGHTS[w] });
  await page.goto(url(v, { t: 'dark', w, sec: w === '390' ? '' : 'tekoaly', ...o }));
  await page.waitForFunction(() => document.querySelector('#frame .app'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
}
async function type(text) {
  await field().click();
  await page.waitForTimeout(80);
  await field().pressSequentially(text, { delay: 15 });
  await page.waitForTimeout(150);
}

// What a search finds, in every direction (the same matcher): name, synonym, compound, nothing.
const finds = [
  ['tumma', 'theme'],          // synonym "tumma tila" → Ulkoasu › Teema
  ['gmail', 'google'],         // synonym → Tiedot agenteille › Google
  ['malli', 'default-model'],  // inside "Oletusmalli"
  ['aani', 'sanelu'],          // accents folded: "ääni" is a synonym of the Sanelu section
  ['recap', 'recap-mode'],     // the coming Tilannekatsaus section
  ['kiintiö', 'usage'],
];
for (let v = 0; v < 3; v++) {
  for (const [qy, id] of finds) {
    await open(v, {});
    await type(qy);
    assert.ok(await count(`[data-testid="result-${id}"], [data-testid="group-${id}"], [data-settings-row="${id}"][data-hit]`) >= 1, `${NAMES[v]} "${qy}" finds ${id}`);
  }
  await open(v, {});
  await type('lomake');
  assert.equal(await count('[data-testid="search-none"]'), 1, `${NAMES[v]}: no results`);
}

// Direction 1: results replace the section list; the pane follows the first result; arrows move it.
await open(0, {});
await type('avain');
assert.equal(await count('.s-nav [data-testid="settings-tekoaly"]'), 0, 'd1 list replaced');
const first = await loc('.r1 li[aria-selected="true"]').getAttribute('data-testid');
assert.ok(first, 'd1 first result selected');
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(150);
const second = await loc('.r1 li[aria-selected="true"]').getAttribute('data-testid');
assert.notEqual(first, second, 'd1 arrow moves the selection');
assert.equal(await count('[data-settings-row][data-landed]'), second.startsWith('result-') && (await count(`[data-settings-row="${second.slice(7)}"]`)) ? 1 : 0, 'd1 pane follows');
await page.keyboard.press('Enter');
await page.waitForTimeout(100);
// A row result focuses the row; a section result focuses the section's heading.
const isRow = (await count(`[data-settings-row="${second.slice(7)}"]`)) > 0;
assert.equal(await page.evaluate(() => document.activeElement?.dataset.settingsRow ?? document.activeElement?.tagName), isRow ? second.slice(7) : 'H2', 'd1 Enter focuses the result');
await page.keyboard.press('Escape');
await page.waitForTimeout(80);
assert.equal(await field().inputValue(), '', 'd1 Escape clears');
assert.equal(await count('.s-nav [data-testid="settings-tekoaly"]'), 1, 'd1 list back');
await page.keyboard.press('Escape');
await page.waitForTimeout(80);
assert.equal(await count('.convo'), 1, 'empty Escape closes Settings');

// Direction 2: the pane is a results page with working controls; the sidebar counts and dims.
await open(1, { t: 'light' });
await type('tumma');
assert.equal(await count('[data-testid="group-ulkoasu"] [data-settings-row="theme"]'), 1, 'd2 theme row in results');
assert.ok(await count('.s-nav-i.dim') > 5, 'd2 dims sections without matches');
assert.equal(await loc('[data-testid="settings-ulkoasu"] .cnt').innerText(), '1');
await loc('[data-testid="group-ulkoasu"] [data-v="dark"]').click();
assert.equal(await page.locator('#frame').getAttribute('data-theme'), 'dark', 'd2 changes the setting in place');
await open(1, {});
await type('sanelu');
assert.ok(await count('[data-testid="group-sanelu"] [data-settings-row]') >= 2, 'd2 a section name shows its rows');
await loc('[data-testid="group-sanelu"] [data-act="open-sec"]').click();
assert.equal(await count('[data-testid="settings-section-sanelu"]'), 1, 'd2 opens the section');
assert.equal(await field().inputValue(), '', 'd2 opening a section clears the search');

// Direction 3: a popover opens on focus with suggestions; Enter jumps and closes it.
await open(2, {});
await field().click();
await page.waitForTimeout(150);
assert.equal(await count('#ss-pop [data-testid="result-default-model"]'), 1, 'd3 suggestions on focus');
await field().pressSequentially('puhelin', { delay: 15 });
await page.waitForTimeout(100);
await page.keyboard.press('Enter');
await page.waitForTimeout(150);
assert.equal(await count('#ss-pop'), 0, 'd3 closes on choice');
assert.equal(await count('[data-testid="settings-section-laitteet"]'), 1, 'd3 opened Laitteet');
assert.equal(await count('[data-settings-row="device-link"][data-landed]'), 1, 'd3 landed on the row');
await field().click();
await page.waitForTimeout(100);
assert.equal(await count('#ss-pop'), 1, 'd3 reopens with the query');
await page.keyboard.press('Escape');
assert.equal(await count('#ss-pop'), 0, 'd3 Escape closes the popover');
assert.equal(await count('.convo'), 0, 'd3 first Escape does not close Settings');

// The X returns to the conversation; the account reopens Settings. Admin rows only for an admin.
for (let v = 0; v < 4; v++) {
  await open(v, {});
  await loc('[data-testid="settings-close"]').click();
  assert.equal(await count('.convo'), 1, `${NAMES[v]}: X closes`);
  await loc('[data-testid="open-settings"]').click();
  assert.equal(await count('[data-testid="settings-close"]'), 1, `${NAMES[v]}: reopens`);
}
await open(0, { role: 'person' });
await type('oauth');
assert.equal(await count('[data-testid="search-none"]'), 1, 'person does not find admin settings');
await open(0, { role: 'admin' });
await type('oauth');
assert.ok(await count('[data-testid="result-app-google"]'), 'admin finds server integrations');

// Phone: d1 results in the list and back to them; d3 full-screen sheet.
await open(0, { w: '390' });
await type('gmail');
await loc('[data-testid="result-google"]').click();
await page.waitForTimeout(150);
assert.equal(await count('[data-settings-row="google"][data-landed]'), 1, 'd1 phone lands');
assert.match(await loc('.s-back').innerText(), /Hakutulokset/);
await loc('.s-back').click();
assert.equal(await count('[data-testid="result-google"]'), 1, 'd1 phone back to results');
await open(2, { w: '390' });
await field().click();
await page.waitForTimeout(250);
assert.equal(await count('[data-testid="search-sheet"]'), 1, 'd3 phone sheet');

// Screenshots: each direction, a search under way, both themes, desktop and phone.
const QUERY = { 0: 'avain', 1: 'avain', 2: 'avain' };
for (let v = 0; v < 4; v++) {
  for (const t of ['dark', 'light']) {
    for (const w of ['1280', '390']) {
      const wn = w === '390' ? 'puhelin' : '1280';
      await open(v, { t, w });
      await shot(`${NAMES[v]}-asetukset-${wn}-${theme(t)}`);
      if (v === 3) continue;
      await type(QUERY[v]);
      await page.waitForTimeout(250);
      await shot(`${NAMES[v]}-haku-${wn}-${theme(t)}`);
    }
  }
}
// The moments that decide: landing on a result, a synonym, nothing found.
await open(0, {}); await type('tumma'); await page.waitForTimeout(250); await shot('1-sivupalkissa-synonyymi-1280-tumma');
await open(0, { w: '390', t: 'light' }); await type('gmail'); await loc('[data-testid="result-google"]').click(); await page.waitForTimeout(400); await shot('1-sivupalkissa-osuman-rivi-puhelin-vaalea');
await open(1, {}); await type('malli'); await page.waitForTimeout(250); await shot('2-tulossivu-malli-1280-tumma');
await open(2, {}); await field().click(); await page.waitForTimeout(250); await shot('3-pikahaku-ehdotukset-1280-tumma');
await open(2, {}); await type('puhelin'); await page.keyboard.press('Enter'); await page.waitForTimeout(400); await shot('3-pikahaku-osuman-rivi-1280-tumma');
await open(2, { w: '390', t: 'light' }); await type('recap'); await page.waitForTimeout(250); await shot('3-pikahaku-recap-puhelin-vaalea');
await open(0, {}); await type('lomake'); await shot('1-sivupalkissa-ei-osumia-1280-tumma');
await open(0, {}); await loc('[data-testid="settings-close"]').click(); await shot('suljettu-keskustelu-1280-tumma');

// Picker and console.
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(pathToFileURL(file).href);
await page.waitForFunction(() => document.querySelector('#frame .app'));
await checkPicker(page, '2026-10-28-asetusten-haku');
for (const key of ['2', '3', '4', '1']) { await page.keyboard.press(key); await page.waitForTimeout(80); }
assert.equal(await page.locator('.proto-picker-item[data-active]').innerText(), '1 Sivupalkissa');

await browser.close();
// The issue keeps AVIF, not PNG (issuectl doctor); Playwright writes only PNG.
for (const png of readdirSync(out).filter(f => f.endsWith('.png'))) {
  const src = path.join(out, png);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-c:v', 'libaom-av1', '-still-picture', '1', '-crf', '28', '-cpu-used', '6', '-pix_fmt', 'yuv444p', src.replace(/\.png$/, '.avif')]);
  rmSync(src);
}
assert.deepEqual(errors, [], 'console errors');
assert.deepEqual(requests, [], 'network requests');
console.log(`ok: interactions and ${readdirSync(out).length} screenshots in ${path.relative(root, out)}`);
