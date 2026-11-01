// Screenshots of ylapalkki.html at device scale factor 2, and a console
// check that presses every header control in every direction, theme,
// device and width.
// Run: NODE_PATH=<repo>/web/node_modules node shoot.mjs <outdir>
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(path.join(process.env.NODE_PATH, 'x.js'));
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || path.join(here, 'kuvat');
const page0 = 'file://' + path.join(here, 'ylapalkki.html');

// [name, query, clicks inside #stage, hover selector]
const shots = [
  ['01-nykyinen-tyopoyta-vaalea', 'v=1&t=light&d=desktop', [], '[data-act="recap"]'],
  ['02-nykyinen-kapea-tumma-valikko', 'v=1&t=dark&d=desktop&w=narrow', ['[data-more]']],
  ['03-nykyinen-puhelin-vaalea-valikko', 'v=1&t=light&d=phone', ['[data-more]']],
  ['04-suunta1-tyopoyta-vaalea', 'v=2&t=light&d=desktop', []],
  ['04b-suunta1-hyvin-levea-vaalea', 'v=2&t=light&d=desktop&w=xwide', []],
  ['01b-nykyinen-tyopoyta-tumma-lyhyt-otsikko', 'v=1&t=dark&d=desktop&n=short', []],
  ['05-suunta1-kapea-tumma', 'v=2&t=dark&d=desktop&w=narrow', []],
  ['06-suunta1-puhelin-tumma', 'v=2&t=dark&d=phone', []],
  ['07-suunta2-tyopoyta-vaalea-valikko', 'v=3&t=light&d=desktop', ['[data-more]']],
  ['08-suunta2-tyopoyta-tumma-paate-auki', 'v=3&t=dark&d=desktop', ['[data-act="terminal"]']],
  ['09-suunta2-puhelin-vaalea', 'v=3&t=light&d=phone', []],
  ['10-suunta2-puhelin-tumma-valikko', 'v=3&t=dark&d=phone', ['[data-more]']],
  ['11-suunta3-tyopoyta-vaalea-ensikerta', 'v=4&t=light&d=desktop&f=first', []],
  ['12-suunta3-kapea-tumma-ensikerta', 'v=4&t=dark&d=desktop&w=narrow&f=first', []],
  ['13-suunta3-puhelin-vaalea-ensikerta', 'v=4&t=light&d=phone&f=first', []],
  ['14-suunta1-editori-auki-vaalea', 'v=2&t=light&d=desktop', ['[data-act="editor"]']],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1780, height: 1100 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
for (const [name, query, clicks, hover] of shots) {
  await page.goto(`${page0}?${query}`);
  await page.waitForSelector('.app');
  await page.waitForTimeout(150);
  for (const sel of clicks) { await page.click(`#stage ${sel}`); await page.waitForTimeout(300); }
  if (hover) { await page.hover(`#stage ${hover}`); await page.waitForTimeout(500); }
  await page.locator('.app-wrap').screenshot({ path: path.join(out, `${name}.png`) });
  console.log(name);
}
// Every direction, theme, device and width renders without errors, and
// every header control can be pressed, from the row or from the menu.
const ids = ['editor', 'terminal', 'recap', 'retitle', 'rename', 'archive', 'details', 'workspace', 'help'];
for (const v of [1, 2, 3, 4]) for (const t of ['light', 'dark']) for (const d of ['desktop', 'phone']) for (const w of ['wide', 'narrow', 'xwide']) for (const n of ['long', 'short']) {
  if (d === 'phone' && w === 'narrow') continue;
  await page.goto(`${page0}?v=${v}&t=${t}&d=${d}&w=${w}&n=${n}`);
  await page.waitForSelector('.app');
  const coach = page.locator('#stage [data-coach-ok]');
  if (await coach.count()) await coach.click();
  for (const id of ids) {
    let el = page.locator(`#stage .tl > [data-act="${id}"]:visible`);
    if (!(await el.count())) {
      const more = page.locator('#stage [data-more]:visible');
      if (!(await more.count())) continue;
      await more.click();
      el = page.locator(`#stage .menu-pop [data-act="${id}"]`);
      if (!(await el.count())) { await page.keyboard.press('Escape'); continue; }
    }
    await el.first().click();
    await page.waitForTimeout(60);
    await page.keyboard.press('Escape');
    // The editor covers a phone's screen; its own × closes it.
    const pane = page.locator('#stage .pane [data-act="editor"]');
    if (d === 'phone' && (await pane.count())) await pane.click();
  }
  await page.waitForTimeout(1000);
}
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'console clean');
await browser.close();
