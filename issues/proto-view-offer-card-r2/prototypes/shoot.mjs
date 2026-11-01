// Screenshots of nakymakortti-r2.html at device scale factor 2, the picker
// check, and a console check of every riff in both themes, devices, link
// settings and address models with every card control pressed.
// Run: NODE_PATH=<repo>/web/node_modules node shoot.mjs <outdir>
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPicker } from '../../../design-system/prototypes/picker-check.mjs';

const require = createRequire(path.join(process.env.NODE_PATH, 'x.js'));
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || path.join(here, 'kuvat');
const page0 = 'file://' + path.join(here, 'nakymakortti-r2.html');

const shots = [
  ['01-lahto-tyopoyta-vaalea-valikko', 'v=1&t=light&d=desktop', ['[data-vis="v2"]']],
  ['02-lahto-kaksi-osoitetta', 'v=1&t=light&d=desktop', ['[data-tab="v1"]']],
  ['03-a-tyopoyta-vaalea-valikko', 'v=2&t=light&d=desktop', ['[data-vis="v2"]']],
  ['04-a-julkaistu-yksi-osoite-tumma', 'v=2&t=dark&d=desktop', ['[data-vis="v2"]', '[data-set-public="v2"]', '[data-tab="v2"]']],
  ['05-a-puhelin-vaalea', 'v=2&t=light&d=phone', []],
  ['06-b-tyopoyta-vaalea', 'v=3&t=light&d=desktop', []],
  ['07-b-julkaistu-kopioitu-tumma', 'v=3&t=dark&d=desktop', ['[data-toggle="v2"]', '[data-copy="v2"]']],
  ['08-b-puhelin-tumma', 'v=3&t=dark&d=phone', []],
  ['09-c-tyopoyta-vaalea', 'v=4&t=light&d=desktop', []],
  ['10-c-tyopoyta-tumma-ei-linkkeja', 'v=4&t=dark&d=desktop&l=off', []],
  ['11-c-puhelin-vaalea', 'v=4&t=light&d=phone', []],
  ['12-c-paneeli-julkinen-vaalea', 'v=4&t=light&d=desktop', ['[data-open="v1"]']],
  ['13-c-yksityiseksi-malli-1', 'v=4&t=light&d=desktop&m=born', ['[data-set-private="v1"]']],
  ['14-c-yksityiseksi-malli-2', 'v=4&t=light&d=desktop&m=stable', ['[data-set-private="v1"]']],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(page0);
await page.waitForSelector('.app');
await checkPicker(page, 'proto-view-offer-card-r2');
for (const [name, query, clicks] of shots) {
  await page.goto(`${page0}?${query}`);
  await page.waitForSelector('.app');
  for (const sel of clicks) { await page.click(`#stage ${sel}`); await page.waitForTimeout(500); }
  await page.locator('.pg').screenshot({ path: path.join(out, `${name}.png`) });
  console.log(name);
}
// Every riff, theme, device, link setting and address model renders
// without errors, and every card control can be pressed.
const controls = ['[data-open="v1"]', '[data-close]', '[data-tab="v2"]', '[data-vis="v2"]', '[data-set-public="v2"]', '[data-toggle="v2"]',
  '[data-copy="v2"]', '[data-tab="v2"]', '[data-vis="v1"]', '[data-set-private="v1"]', '[data-toggle="v1"]', '[data-share="v2"]', '[data-create="v2"]', '[data-dclose]'];
for (const v of [1, 2, 3, 4]) for (const t of ['light', 'dark']) for (const d of ['desktop', 'phone']) for (const l of ['on', 'off']) for (const m of ['born', 'stable']) {
  await page.goto(`${page0}?v=${v}&t=${t}&d=${d}&l=${l}&m=${m}`);
  await page.waitForSelector('.app');
  for (const sel of controls) {
    const el = page.locator(`#stage ${sel}`).first();
    if (!(await el.count())) continue;
    // A press outside an open menu only closes it, as in a browser.
    if (await page.locator('#stage .menu-pop').count() && !(await el.evaluate((n) => !!n.closest('.menu-pop')))) await page.keyboard.press('Escape');
    await el.click(); await page.waitForTimeout(60);
  }
}
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'console clean');
await browser.close();
