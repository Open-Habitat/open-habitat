// Screenshots of nakymakortti-r3.html at device scale factor 2, the picker
// check, and a console check of every riff in both themes, devices, link
// settings and site maximums with every card control pressed.
// Run: NODE_PATH=<repo>/web/node_modules node shoot.mjs <outdir>
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPicker } from '../../../design-system/prototypes/picker-check.mjs';

const require = createRequire(path.join(process.env.NODE_PATH, 'x.js'));
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || path.join(here, 'kuvat');
const page0 = 'file://' + path.join(here, 'nakymakortti-r3.html');

const shots = [
  ['01-lahto-tyopoyta-vaalea', 'v=1&t=light&d=desktop', ['[data-toggle="v2"]']],
  ['02-lahto-puhelin-tumma', 'v=1&t=dark&d=phone', []],
  ['03-a-valikko-auki-vaalea', 'v=2&t=light&d=desktop', ['[data-exp="v1"]']],
  ['04-a-7-paivaa-valittu-tumma', 'v=2&t=dark&d=desktop', ['[data-toggle="v2"]', '[data-exp="v2"]', '[data-days="7"][data-view="v2"]', '[data-exp="v2"]']],
  ['05-a-puhelin-vaalea', 'v=2&t=light&d=phone', ['[data-exp="v1"]']],
  ['06-b-kalenteri-vaalea', 'v=3&t=light&d=desktop', ['[data-exp="v1"]']],
  ['07-b-kalenteri-tumma-seuraava-kuu', 'v=3&t=dark&d=desktop', ['[data-exp="v1"]', '[data-month="1"]']],
  ['08-b-puhelin-tumma', 'v=3&t=dark&d=phone', ['[data-exp="v1"]']],
  ['09-c-rivi-auki-vaalea', 'v=4&t=light&d=desktop', ['[data-exp="v1"]']],
  ['10-c-rivi-auki-tumma', 'v=4&t=dark&d=desktop', ['[data-toggle="v2"]', '[data-exp="v2"]']],
  ['11-c-puhelin-vaalea', 'v=4&t=light&d=phone', ['[data-exp="v1"]']],
  ['12-a-enimmaisaika-7-vaalea', 'v=2&t=light&d=desktop&x=7', ['[data-exp="v1"]']],
  ['13-c-ei-linkkeja-tumma', 'v=4&t=dark&d=desktop&l=off', []],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(page0);
await page.waitForSelector('.app');
await checkPicker(page, 'proto-view-offer-card-r3');
for (const [name, query, clicks] of shots) {
  await page.goto(`${page0}?${query}`);
  await page.waitForSelector('.app');
  for (const sel of clicks) { await page.click(`#stage ${sel}`); await page.waitForTimeout(300); }
  await page.locator('.pg').screenshot({ path: path.join(out, `${name}.png`) });
  console.log(name);
}
// Every riff, theme, device, link setting and maximum renders without
// errors, and every card control can be pressed.
const controls = ['[data-open="v1"]', '[data-close]', '[data-tab="v2"]', '[data-toggle="v2"]', '[data-exp="v2"]', '[data-month="1"]',
  '[data-month="-1"]', '[data-days]', '[data-exp="v2"]', '.cal-g button[data-days]', '[data-copy="v2"]', '[data-tab="v2"]', '[data-exp="v1"]',
  '[data-days][data-view="v1"]', '[data-toggle="v1"]'];
for (const v of [1, 2, 3, 4]) for (const t of ['light', 'dark']) for (const d of ['desktop', 'phone']) for (const l of ['on', 'off']) for (const x of [7, 90, 365]) {
  await page.goto(`${page0}?v=${v}&t=${t}&d=${d}&l=${l}&x=${x}`);
  await page.waitForSelector('.app');
  for (const sel of controls) {
    const el = page.locator(`#stage ${sel}:not([disabled])`).last();
    if (!(await el.count())) continue;
    // A press outside an open menu or calendar only closes it, as in a browser.
    if (await page.locator('#stage .pop').count() && !(await el.evaluate((n) => !!n.closest('.pop')))) await page.keyboard.press('Escape');
    await el.click(); await page.waitForTimeout(40);
  }
  // Nothing in the title row may overflow the card.
  const over = await page.evaluate(() => [...document.querySelectorAll('#stage .vo')].some((c) => c.scrollWidth > c.clientWidth + 1));
  if (over) errors.push(`overflow: v=${v} t=${t} d=${d} l=${l} x=${x}`);
}
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'console clean');
await browser.close();
