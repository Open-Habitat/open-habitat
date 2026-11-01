// Screenshots of ensiopastus.html at device scale factor 2, and a console
// check that presses every header control in every direction, theme,
// device, width and situation.
// Run: NODE_PATH=<repo>/web/node_modules node shoot.mjs <outdir>
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(path.join(process.env.NODE_PATH, 'x.js'));
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || path.join(here, 'kuvat');
const page0 = 'file://' + path.join(here, 'ensiopastus.html');

// [name, query, clicks inside #stage, hover selector, long press selector]
const shots = [
  ['01-pohja-tyopoyta-vaalea-ensimmainen', 'v=1&t=light&d=desktop&s=first', []],
  ['02-pohja-puhelin-tumma-toinen-laite', 'v=1&t=dark&d=phone&s=other', []],
  ['03-pohja-tyopoyta-tumma-julkaisu', 'v=1&t=dark&d=desktop&s=release', []],
  ['04-riffi1-tyopoyta-vaalea-ensimmainen', 'v=2&t=light&d=desktop&s=first', []],
  ['05-riffi1-tyopoyta-tumma-toinen-laite', 'v=2&t=dark&d=desktop&s=other', []],
  ['06-riffi1-tyopoyta-vaalea-julkaisu', 'v=2&t=light&d=desktop&s=release', []],
  ['07-riffi1-puhelin-tumma-julkaisu', 'v=2&t=dark&d=phone&s=release', []],
  ['08-riffi1-puhelin-vaalea-ensimmainen', 'v=2&t=light&d=phone&s=first', []],
  ['09-riffi2-tyopoyta-vaalea-vihje', 'v=3&t=light&d=desktop&s=first', [], '[data-act="terminal"]'],
  ['10-riffi2-tyopoyta-tumma-valikko', 'v=3&t=dark&d=desktop&s=first', ['[data-more]']],
  ['11-riffi2-puhelin-vaalea-pitka-painallus', 'v=3&t=light&d=phone&s=first', [], null, '[data-act="terminal"]'],
  ['12-riffi3-tyopoyta-vaalea-paate', 'v=4&t=light&d=desktop&s=first', ['[data-act="terminal"]']],
  ['13-riffi3-tyopoyta-tumma-arkistoi', 'v=4&t=dark&d=desktop&s=next', ['[data-act="archive"]']],
  ['14-riffi3-puhelin-vaalea-paate', 'v=4&t=light&d=phone&s=first', ['[data-act="terminal"]']],
  ['15-riffi3-puhelin-tumma-julkaisu', 'v=4&t=dark&d=phone&s=release', ['[data-act="views"]']],
  ['16-riffi1-kapea-vaalea-ensimmainen', 'v=2&t=light&d=desktop&w=narrow&s=first', []],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1780, height: 1100 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
for (const [name, query, clicks, hover, hold] of shots) {
  await page.goto(`${page0}?${query}`);
  await page.waitForSelector('.app');
  await page.waitForTimeout(150);
  for (const sel of clicks) { await page.click(`#stage ${sel}`); await page.waitForTimeout(300); }
  if (hover) { await page.hover(`#stage ${hover}`); await page.waitForTimeout(500); }
  if (hold) { await page.hover(`#stage ${hold}`); await page.mouse.down(); await page.waitForTimeout(700); }
  await page.locator('.app-wrap').screenshot({ path: path.join(out, `${name}.png`) });
  if (hold) await page.mouse.up();
  console.log(name);
}
// Every riff, theme, device, width and situation renders without errors,
// and every header control can be pressed, from the row or from the menu.
const ids = ['editor', 'terminal', 'views', 'recap', 'retitle', 'rename', 'archive', 'details', 'workspace', 'help'];
let pressed = 0;
for (const v of [1, 2, 3, 4]) for (const t of ['light', 'dark']) for (const d of ['desktop', 'phone']) for (const w of ['wide', 'narrow', 'xwide']) for (const s of ['first', 'next', 'other', 'release']) {
  if (d === 'phone' && w !== 'wide') continue;
  await page.goto(`${page0}?v=${v}&t=${t}&d=${d}&w=${w}&s=${s}`);
  await page.waitForSelector('.app');
  const coach = page.locator('#stage [data-coach-ok]');
  if (await coach.count()) await coach.click();
  for (const id of ids) {
    let el = page.locator(`#stage .tl > [data-act="${id}"]:visible`);
    if (!(await el.count())) {
      await page.locator('#stage [data-more]:visible').click();
      el = page.locator(`#stage .menu-pop [data-act="${id}"]`);
      if (!(await el.count())) { await page.keyboard.press('Escape'); continue; }
    }
    await el.first().click();
    pressed++;
    await page.waitForTimeout(40);
    const confirm = page.locator('#stage [data-note-confirm]');
    if (await confirm.count()) await confirm.click();
    await page.keyboard.press('Escape');
    // The editor covers a phone's screen; its own × closes it.
    const pane = page.locator('#stage .pane [data-act="editor"]');
    if (d === 'phone' && (await pane.count())) await pane.click();
  }
  await page.waitForTimeout(950);
}
console.log(`${pressed} presses`);
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'console clean');
await browser.close();
