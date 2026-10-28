// Builds the round into its issue and checks it offline. Every variant (three directions and
// Nykyinen) walks Google's guide from the row to Tarjolla by clicking, on the 1280 px desktop and a
// 390 px phone, in light and dark; Microsoft and Dropbox are walked to their last step in light, and
// Minulla on jo asiakas once per variant. Checks that nothing in the dialog overflows its width,
// that an empty save is refused on the step with the fields, that the console and the network stay
// quiet, and that the picker passes picker-check. Screenshots at device scale factor 2 go to
// issues/proto-google-wizard-secrets-step/shots/.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-10-28-google-tunnukset/verify.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkPicker } from '../../picker-check.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const require = createRequire(path.join(root, 'web/package.json'));
const { chromium } = require('@playwright/test');

const issue = path.join(root, 'issues/proto-google-wizard-secrets-step');
const file = path.join(issue, 'prototype/index.html');
const out = path.join(issue, 'shots');
execFileSync('node', [path.join(here, 'build.mjs'), '--out', file], { stdio: 'inherit' });
mkdirSync(out, { recursive: true });

const NAMES = ['1-peraan', '2-rinnakkain', '3-vuorotellen', 'nykyinen'];
const STEPS = { // [steps in the directions, steps in Nykyinen]
  google: [4, 5], microsoft: [4, 5], dropbox: [3, 4],
};
const HEIGHTS = { 1280: 900, 390: 844 };
const errors = [], requests = [];
const browser = await chromium.launch();
const url = (v, o) => pathToFileURL(file).href + '?' + new URLSearchParams({ v: v + 1, ...o });
let shots = 0;

async function open(v, w, t, bare = true) {
  const ctx = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: +w, height: HEIGHTS[w] } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
  await page.goto(url(v, { w, t, ...(bare ? { bare: '1' } : {}) }));
  await page.locator('#frame .app').waitFor();
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page };
}
async function fits(page, what) {
  const bad = await page.evaluate(() => {
    const d = document.querySelector('[role=dialog]');
    if (!d) return [];
    const box = d.getBoundingClientRect();
    return [...d.querySelectorAll('*')].filter(el => {
      const r = el.getBoundingClientRect();
      return r.width && (r.left < box.left - 1 || r.right > box.right + 1);
    }).map(el => el.className || el.tagName).slice(0, 5);
  });
  assert.deepEqual(bad, [], `${what}: overflows the dialog`);
}
const shot = async (page, name) => { await page.screenshot({ path: path.join(out, `${name}.png`) }); shots++; };
// The whole dialog, scrolled, when it is taller than the window.
async function shotTall(page, name) {
  const modal = page.locator('.ah-modal');
  const tall = await modal.evaluate(m => m.scrollHeight > m.clientHeight + 2);
  await shot(page, name);
  if (tall) { await modal.evaluate(m => { m.scrollTop = m.scrollHeight; }); await page.waitForTimeout(50); await shot(page, name + '-end'); await modal.evaluate(m => { m.scrollTop = 0; }); }
}

// Picker contract, once, with the chrome visible.
{
  const { ctx, page } = await open(0, '1280', 'light', false);
  await checkPicker(page, '2026-10-28-google-tunnukset');
  for (const [i] of NAMES.entries()) { await page.keyboard.press(String(i + 1)); await page.locator(`#frame[data-variant]`).waitFor(); }
  await shot(page, 'picker-chrome');
  await ctx.close();
}

for (const [v, name] of NAMES.entries()) {
  const cur = name === 'nykyinen';
  for (const w of ['1280', '390']) for (const t of ['light', 'dark']) {
    const { ctx, page } = await open(v, w, t);
    const d = page.getByTestId('si-setup-dialog');
    const tag = `${name}-google-${w === '390' ? 'phone' : 'desktop'}-${t}`;
    await page.getByTestId('si-setup-google').click();
    const n = STEPS.google[cur ? 1 : 0];
    for (let i = 0; i < n; i++) {
      await fits(page, `${tag} step ${i + 1}`);
      if (i === n - 1) {
        // Only the last step takes values; an empty save is refused there.
        await d.getByTestId('si-save').click();
        await d.locator('[aria-invalid]').first().waitFor();
        await page.evaluate(() => document.getElementById('fill').click());
        await shotTall(page, `${tag}-${i + 1}`);
        await d.getByTestId('si-save').click();
      } else {
        // Steps before the last are production's in every direction; Nykyinen shows them.
        if (cur && (i === n - 2 || (w === '1280' && t === 'light'))) await shotTall(page, `${tag}-${i + 1}`);
        await d.getByTestId('si-next').click();
      }
    }
    await page.locator('[data-testid=si-row-google][data-status=ready]').waitFor();
    if (w === '1280' && t === 'light') await shot(page, `${tag}-done`);
    await ctx.close();
  }
  // Microsoft and Dropbox: the last step, filled, desktop and phone in light.
  for (const p of ['microsoft', 'dropbox']) for (const w of ['1280', '390']) {
    const { ctx, page } = await open(v, w, 'light');
    const d = page.getByTestId('si-setup-dialog');
    await page.getByTestId(`si-setup-${p}`).click();
    const n = STEPS[p][cur ? 1 : 0];
    for (let i = 1; i < n; i++) await d.getByTestId('si-next').click();
    await page.evaluate(() => document.getElementById('fill').click());
    await fits(page, `${name} ${p} ${w}`);
    const tag = `${name}-${p}-${w === '390' ? 'phone' : 'desktop'}-light`;
    if (n - 1 >= 1 && cur) { await d.getByTestId('si-back').click(); await shotTall(page, `${tag}-${n - 1}`); await d.getByTestId('si-next').click(); await page.evaluate(() => document.getElementById('fill').click()); }
    await shotTall(page, `${tag}-${n}`);
    if (p === 'microsoft' && !cur) assert.ok(!(await page.getByTestId('gw-consent-link').locator('[data-template]').count()), `${name}: the consent link fills from the values`);
    await d.getByTestId('si-save').click();
    await page.locator(`[data-testid=si-row-${p}][data-status=ready]`).waitFor();
    await ctx.close();
  }
  // Minulla on jo asiakas.
  {
    const { ctx, page } = await open(v, '1280', 'light');
    await page.getByTestId('si-setup-google').click();
    await page.getByTestId('si-skip').click();
    await fits(page, `${name} skip`);
    await shot(page, `${name}-google-desktop-light-skip`);
    await ctx.close();
  }
}
await browser.close();
assert.deepEqual(errors, [], 'console errors');
assert.deepEqual(requests, [], 'network requests');
console.log(`ok: ${NAMES.length} variants, ${shots} screenshots in ${path.relative(root, out)}`);
