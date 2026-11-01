// Screenshots of nakymakortti.html at device scale factor 2, and a console
// check of every direction in both themes and devices.
// Run: NODE_PATH=<repo>/web/node_modules node shoot.mjs <outdir>
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(path.join(process.env.NODE_PATH, 'x.js'));
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || path.join(here, 'kuvat');
const page0 = 'file://' + path.join(here, 'nakymakortti.html');

const shots = [
  ['01-nykyinen-tyopoyta-vaalea', 'v=1&t=light&d=desktop', ['[data-tab="v2"]']],
  ['02-nykyinen-puhelin-tumma', 'v=1&t=dark&d=phone', ['[data-tab="v2"]']],
  ['03-suunta1-tyopoyta-vaalea', 'v=2&t=light&d=desktop', []],
  ['04-suunta1-tyopoyta-tumma-ei-linkkeja', 'v=2&t=dark&d=desktop&l=off', []],
  ['05-suunta1-puhelin-vaalea', 'v=2&t=light&d=phone', []],
  ['06-suunta2-tyopoyta-vaalea', 'v=3&t=light&d=desktop', []],
  ['07-suunta2-puhelin-tumma', 'v=3&t=dark&d=phone', []],
  ['08-suunta3-tyopoyta-vaalea-valikko', 'v=4&t=light&d=desktop', ['[data-vis="v2"]']],
  ['09-suunta3-tyopoyta-tumma-jaettu-valikko', 'v=4&t=dark&d=desktop', ['[data-vis="v1"]']],
  ['10-suunta3-puhelin-vaalea', 'v=4&t=light&d=phone', []],
  ['11-suunta1-paneeli-tiedostonimi-vaalea', 'v=2&t=light&d=desktop&n=file', ['[data-open="v2"]']],
  ['12-suunta1-jaa-ikkuna-tumma', 'v=2&t=dark&d=desktop', ['[data-share="v2"]', '[data-create="v2"]']],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
for (const [name, query, clicks] of shots) {
  await page.goto(`${page0}?${query}`);
  await page.waitForSelector('.app');
  for (const sel of clicks) { await page.click(`#stage ${sel}`); await page.waitForTimeout(600); }
  await page.locator('.pg').screenshot({ path: path.join(out, `${name}.png`) });
  console.log(name);
}
// Every direction, theme, device and link setting renders without errors,
// and every card control can be pressed.
for (const v of [1, 2, 3, 4]) for (const t of ['light', 'dark']) for (const d of ['desktop', 'phone']) for (const l of ['on', 'off']) {
  await page.goto(`${page0}?v=${v}&t=${t}&d=${d}&l=${l}`);
  await page.waitForSelector('.app');
  for (const sel of ['[data-open="v1"]', '[data-close]', '[data-tab="v2"]', '[data-vis="v1"]', '[data-share="v2"]', '[data-create="v2"]', '[data-dclose]']) {
    const el = page.locator(`#stage ${sel}`).first();
    if (await el.count()) { await el.click(); await page.waitForTimeout(80); }
  }
}
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'console clean');
await browser.close();
