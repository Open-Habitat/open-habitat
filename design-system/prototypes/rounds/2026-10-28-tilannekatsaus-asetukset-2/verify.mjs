// Builds round 2 into its issue and checks it offline. Every variant (three groupings and
// Nykyinen): the free delay decides when the card or the Luo katsaus row appears; the model
// picker opens as a popover on desktop and a sheet on phones, keeps Fable and Opus unselectable,
// and is the same component in Tekoäly › Oletusmalli; numbers clamp to their bounds, the output
// cap warns when too small for the words, Palauta oletukset restores the host's values; A's fold,
// C's levels and Oma. Screenshots of Settings and the conversation on a 1280 px desktop and a 390 px
// phone, dark and light, at device scale factor 2, kept as AVIF (ffmpeg's libaom-av1). No console
// errors or network requests; the picker passes picker-check.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-10-28-tilannekatsaus-asetukset-2/verify.mjs
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

const dir = path.join(root, 'issues/proto-recap-settings/prototypes/recap-settings-2');
const file = path.join(dir, 'index.html');
const out = path.join(dir, 'evidence');
execFileSync('node', [path.join(here, 'build.mjs'), '--out', file], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });

const NAMES = ['1-perus-lisat', '2-kaikki-nakyvissa', '3-tasot', 'nykyinen'];
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
const F = sel => page.locator('#frame ' + sel);
const count = sel => F(sel).count();
const click = sel => F(sel).first().click();
const text = sel => F(sel).first().innerText();

async function open(v, o = {}) {
  const w = o.w ?? '1280';
  await page.setViewportSize({ width: +w, height: HEIGHTS[w] });
  await page.goto(url(v, { n: 'asetukset', s: '3', t: 'dark', w, ...o }));
  await page.waitForFunction(() => document.querySelector('#frame .app'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250); // entrance animations settle
}
const setRange = (v) => F('input[type=range][data-k="d"]').evaluate((el, v) => {
  el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
}, v);

// The section exists in A–C, opens first, and holds no "pisin viive" text; Nykyinen has none.
for (let v = 0; v < 4; v++) {
  await open(v);
  assert.equal(await count('[data-testid="settings-tilannekatsaus"]'), v < 3 ? 1 : 0, `${NAMES[v]}: own section`);
  assert.doesNotMatch(await text('[data-testid="settings-main"]'), /pisin viive|Lasketaan viimeisestä/, `${NAMES[v]}: removed text`);
  if (v < 3) {
    assert.equal(await count('[data-testid="mp-recap"]'), 1, `${NAMES[v]}: recap model picker`);
    assert.equal(await count('[data-testid="delay"] input[type=range]'), 1, `${NAMES[v]}: delay slider`);
  }
}

// The free delay: bounds 1–9 min in half minutes; the card comes when silence reaches it.
let cases = 0;
for (let v = 0; v < 3; v++) {
  await open(v);
  const r = F('input[type=range][data-k="d"]');
  assert.deepEqual([await r.getAttribute('min'), await r.getAttribute('max'), await r.getAttribute('step')], ['1', '9', '0.5'], `${NAMES[v]}: delay bounds`);
  await setRange(4.5);
  assert.equal(await text('[data-testid="delay-value"]'), '4,5 min', `${NAMES[v]}: delay readout`);
  await click('.rail-item.sub[data-to="keskustelu"]');
  assert.equal(await count('[data-testid="recap-card"]'), 0, `${NAMES[v]}: 3 min < 4,5 min`);
  for (const [s, card] of [['5', 1], ['9', 1], ['1', 0]]) {
    await page.locator(`.pc-group[data-k="s"] button[data-v="${s}"]`).evaluate(b => b.click());
    assert.equal(await count('[data-testid="recap-card"]'), card, `${NAMES[v]}: silence ${s} with delay 4,5`);
    cases++;
  }
}
for (let v = 0; v < 4; v++) for (const m of ['auto', 'ask', 'off']) for (const s of ['1', '3', '9']) {
  await open(v, { n: 'keskustelu', m, s, d: '2' });
  const eff = v === 3 ? 'auto' : m, isDue = v === 3 ? +s >= 3 : +s >= 2;
  assert.equal(await count('[data-testid="recap-card"]'), isDue && eff === 'auto' ? 1 : 0, `${NAMES[v]} ${m} ${s}: card`);
  assert.equal(await count('[data-testid="recap-offer"]'), isDue && eff === 'ask' ? 1 : 0, `${NAMES[v]} ${m} ${s}: offer`);
  cases++;
}
// Luo katsaus makes the card; the card's gear lands on the section.
for (let v = 0; v < 3; v++) {
  await open(v, { n: 'keskustelu', m: 'ask' });
  await click('[data-act="request"]');
  assert.equal(await count('.ah-recap-skeleton'), 1, `${NAMES[v]}: skeleton`);
  await page.waitForTimeout(800);
  await click('[data-testid="card-settings"]');
  await page.waitForTimeout(150);
  assert.equal(await count('[data-settings-row="tilannekatsaus"][data-landed]'), 1, `${NAMES[v]}: gear lands`);
}
await open(3, { n: 'keskustelu' });
assert.equal(await count('[data-testid="card-settings"]'), 0, 'nykyinen: no gear');

// The standard model picker: recap section and Tekoäly › Oletusmalli, the same component.
await open(0);
await click('[data-testid="mp-recap"]');
assert.equal(await count('[data-testid="mp-panel"]'), 1, 'recap picker opens');
assert.equal(await count('[data-testid="mp-row-auto"] input:checked'), 1, 'Automaattinen is the default');
for (const id of ['claude-fable-5-1', 'claude-opus-5-5']) assert.ok(await F(`[data-testid="mp-row-${id}"] input`).isDisabled(), `${id} not selectable`);
await F('[data-testid="mp-row-claude-fable-5-1"]').click({ force: true });
assert.equal(await count('[data-testid="mp-row-auto"] input:checked'), 1, 'Fable click ignored');
await page.waitForTimeout(250);
await shot('1-perus-lisat-mallivalitsin-1280-tumma');
await click('[data-act="mp-prov"][data-v="openai-codex"]');
await click('[data-testid="mp-row-gpt-6-luna"]');
assert.equal(await count('[data-testid="mp-panel"]'), 0, 'picker closes on choice');
assert.match(await text('[data-testid="mp-recap"]'), /GPT 6 Luna/);
assert.match(await text('[data-testid="recap-preview"]'), /GPT 6 Luna/, 'preview names the model');
await click('[data-testid="mp-recap"]');
await page.keyboard.press('Escape');
assert.equal(await count('[data-testid="mp-panel"]'), 0, 'Escape closes');
await click('[data-testid="settings-tekoaly"]');
await click('[data-testid="mp-default"]');
assert.equal(await count('[data-testid="mp-panel"] .md-think'), 1, 'default picker has thinking level');
assert.equal(await count('[data-testid="mp-row-auto"]'), 0, 'default picker has no Automaattinen');
assert.equal(await F('[data-testid="mp-row-claude-fable-5-1"] input').isDisabled(), false, 'Fable allowed as the default');
await page.waitForTimeout(250);
await shot('1-perus-lisat-oletusmalli-samalla-valitsimella-1280-tumma');
await open(1, { w: '390', t: 'light' });
await click('[data-testid="mp-recap"]');
assert.equal(await count('.mp-sheet[data-testid="mp-panel"]'), 1, 'phone: bottom sheet');
await page.waitForTimeout(250);
await shot('2-kaikki-nakyvissa-mallivalitsin-puhelin-vaalea');
await F('.mp-scrim').click({ position: { x: 20, y: 20 } });
assert.equal(await count('[data-testid="mp-panel"]'), 0, 'scrim closes');

// Numbers: clamp, warn, reset.
await open(1);
await F('input[data-k="msgs"]').fill('500'); await F('input[data-k="msgs"]').press('Enter'); await page.waitForTimeout(60);
assert.equal(await F('input[data-k="msgs"]').inputValue(), '128', 'messages clamp to 128');
await F('input[data-k="ctx"]').fill('100'); await F('input[data-k="ctx"]').press('Enter'); await page.waitForTimeout(60);
assert.equal(await F('input[data-k="ctx"]').inputValue(), '2000', 'context clamps to 2000');
await F('input[data-k="out"]').fill('128'); await F('input[data-k="out"]').press('Enter'); await page.waitForTimeout(60);
assert.equal(await count('[data-testid="out-warn"]'), 1, 'output cap warns');
await page.evaluate(() => document.querySelector('#frame [data-testid="out-warn"]').scrollIntoView({ block: 'center' }));
await shot('2-kaikki-nakyvissa-varoitus-1280-tumma');
await click('[data-testid="reset"]');
assert.equal(await F('input[data-k="msgs"]').inputValue(), '64', 'reset restores 64');
assert.equal(await count('[data-testid="out-warn"]'), 0, 'reset clears the warning');
for (let i = 0; i < 4; i++) await click('[data-act="step"][data-k="words"][data-d="1"]');
assert.equal(await F('input[data-k="words"]').inputValue(), '60');
assert.match(await text('[data-testid="recap-preview"]'), /talvipäivänseisauksesta/, 'longer words, longer preview');

// A: the fold opens, counts changes and holds the advanced rows.
await open(0);
assert.equal(await F('[data-testid="advanced"]').getAttribute('open'), null, 'A: fold closed');
assert.equal(await count('input[data-k="msgs"]:visible'), 0);
await click('[data-testid="advanced"] > summary');
assert.notEqual(await F('[data-testid="advanced"]').getAttribute('open'), null, 'A: fold opens');
await click('[data-act="step"][data-k="msgs"][data-d="-1"]');
assert.match(await text('[data-testid="advanced"] > summary'), /1 muutettu/);
await page.evaluate(() => document.querySelector('#frame [data-testid="advanced"]').scrollIntoView({ block: 'start' }));
await shot('1-perus-lisat-lisaasetukset-auki-1280-tumma');

// C: a level sets every number; Oma opens them; editing leaves the level.
await open(2);
assert.equal(await text('[data-testid="preset"] [aria-checked="true"]'), 'Tavallinen', 'C: host values are Tavallinen');
await click('[data-testid="preset"] [data-v="lyhyt"]');
assert.match(await text('[data-testid="recipe"]'), /16\s*viimeisintä/);
assert.equal(await count('input[data-k="msgs"]'), 0, 'C: numbers hidden');
await click('[data-testid="preset"] [data-v="oma"]');
assert.equal(await count('input[data-k="msgs"]'), 1, 'C: Oma shows numbers');
await click('[data-act="step"][data-k="words"][data-d="1"]');
assert.equal(await text('[data-testid="preset"] [aria-checked="true"]'), 'Oma');
await page.evaluate(() => document.querySelector('#frame [data-settings-row="laajuus"]').scrollIntoView({ block: 'start' }));
await shot('3-tasot-oma-1280-tumma');

// Off disables the delay.
await open(0);
await click('[data-testid="mode"] [data-v="off"]');
assert.equal(await F('[data-testid="delay"]').getAttribute('aria-disabled'), 'true', 'delay disabled when off');

// Screenshots: Settings and conversation, each variant, both themes, desktop and phone.
for (let v = 0; v < 4; v++) {
  for (const t of ['dark', 'light']) {
    for (const w of ['1280', '390']) {
      const wn = w === '390' ? 'puhelin' : '1280';
      await open(v, { t, w });
      await shot(`${NAMES[v]}-asetukset-${wn}-${theme(t)}`);
      if (v < 3) {
        await page.evaluate(() => { const s = document.querySelector('#frame .scroll'); s.scrollTop = s.scrollHeight; });
        await shot(`${NAMES[v]}-asetukset-loppu-${wn}-${theme(t)}`);
      }
      await open(v, { t, w, n: 'keskustelu' });
      await shot(`${NAMES[v]}-keskustelu-${wn}-${theme(t)}`);
    }
  }
}

// Picker and console.
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(pathToFileURL(file).href);
await page.waitForFunction(() => document.querySelector('#frame .app'));
await checkPicker(page, '2026-10-28-tilannekatsaus-asetukset-2');
for (const key of ['2', '3', '4', '1']) { await page.keyboard.press(key); await page.waitForTimeout(80); }
assert.equal(await page.locator('.proto-picker-item[data-active]').innerText(), '1 Perus + lisät');

await browser.close();
// The issue keeps AVIF, not PNG (issuectl doctor); Playwright writes only PNG.
for (const png of readdirSync(out).filter(f => f.endsWith('.png'))) {
  const src = path.join(out, png);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-c:v', 'libaom-av1', '-still-picture', '1', '-crf', '28', '-cpu-used', '6', '-pix_fmt', 'yuv444p', src.replace(/\.png$/, '.avif')]);
  rmSync(src);
}
assert.deepEqual(errors, [], 'console errors');
assert.deepEqual(requests, [], 'network requests');
console.log(`ok: ${cases} timing cases, interactions and screenshots in ${path.relative(root, out)}`);
