// Screenshots of selitys.html at device scale factor 2, and a console check
// that presses every header control and walks every riff's guide in every
// riff, theme, device, width, situation, start-page and guide state.
// Run: NODE_PATH=<repo>/web/node_modules node shoot.mjs <outdir>
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(path.join(process.env.NODE_PATH, 'x.js'));
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || path.join(here, 'kuvat');
const page0 = 'file://' + path.join(here, 'selitys.html');

// [name, query, steps inside #stage: a selector to click, or hover:<selector>]
const next = (n) => Array(n).fill('[data-step="1"]');
const shots = [
  ['01-pohja-tyopoyta-vaalea', 'v=1&t=light&d=desktop&s=new', []],
  ['02-riffi1-tyopoyta-vaalea', 'v=2&t=light&d=desktop&s=new', []],
  ['03-riffi1-kapea-tumma', 'v=2&t=dark&d=desktop&w=narrow&s=new', []],
  ['04-riffi1-puhelin-vaalea', 'v=2&t=light&d=phone&s=new', []],
  ['05-riffi1-ennen-painamista-vaalea', 'v=2&t=light&d=desktop&s=new&o=off', ['hover:[data-point="terminal"]']],
  ['06-riffi2-tyopoyta-vaalea', 'v=3&t=light&d=desktop&s=new', []],
  ['07-riffi2-tyopoyta-tumma', 'v=3&t=dark&d=desktop&s=new', []],
  ['08-riffi2-kapea-vaalea', 'v=3&t=light&d=desktop&w=narrow&s=new', []],
  ['09-riffi2-puhelin-tumma', 'v=3&t=dark&d=phone&s=new', []],
  ['10-riffi2-tyota-valikosta-vaalea', 'v=3&t=light&d=desktop&s=first', ['[data-more]', '.menu-pop [data-act="help"]']],
  ['11-riffi3-askel1-vaalea', 'v=4&t=light&d=desktop&s=new', []],
  ['12-riffi3-askel3-tumma', 'v=4&t=dark&d=desktop&s=new', next(2)],
  ['13-riffi3-askel8-vaalea', 'v=4&t=light&d=desktop&s=new', next(7)],
  ['14-riffi3-kapea-askel5-vaalea', 'v=4&t=light&d=desktop&w=narrow&s=new', next(4)],
  ['15-riffi3-puhelin-askel1-tumma', 'v=4&t=dark&d=phone&s=new', []],
  ['16-riffi3-puhelin-askel3-vaalea', 'v=4&t=light&d=phone&s=new', next(2)],
];

const browser = await chromium.launch();
// Tall enough that nothing scrolls: a hover stays where the pointer is.
const ctx = await browser.newContext({ viewport: { width: 1780, height: 2400 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
for (const [name, query, steps] of shots) {
  await page.goto(`${page0}?${query}`);
  await page.waitForSelector('.app');
  await page.waitForTimeout(150);
  for (const sel of steps) {
    if (sel.startsWith('hover:')) await page.hover(`#stage ${sel.slice(6)}`);
    else await page.click(`#stage ${sel}`);
    await page.waitForTimeout(sel === '[data-send]' ? 1400 : 300);
  }
  await page.locator('.app-wrap').screenshot({ path: path.join(out, `${name}.png`) });
  console.log(name);
}
// Every riff, theme, device, width, situation, start-page and guide state
// renders without errors; every header control can be pressed, from the row
// or the menu; each riff's guide opens from the strip and from ⋯, and walks
// to its end.
const ids = ['editor', 'terminal', 'recap', 'retitle', 'rename', 'archive', 'details', 'workspace', 'help'];
let pressed = 0;
const click = async (sel) => { await page.locator(`#stage ${sel}`).first().click(); pressed++; await page.waitForTimeout(30); };
for (const v of [1, 2, 3, 4]) for (const t of ['light', 'dark']) for (const d of ['desktop', 'phone']) for (const w of ['wide', 'narrow', 'xwide']) for (const s of ['new', 'first', 'later']) for (const p of ['on', 'off']) for (const o of ['on', 'off']) {
  if (d === 'phone' && w !== 'wide') continue;
  if (s === 'first' && p === 'off') continue;
  if ((v === 1 || s !== 'new') && o === 'off') continue;
  const url = `${page0}?v=${v}&t=${t}&d=${d}&w=${w}&s=${s}&p=${p}&o=${o}`;
  await page.goto(url);
  await page.waitForSelector('.app');
  // The default view shows the guide wherever the riff has one.
  const guide = await page.locator('#stage .coach.guide').count();
  if (v > 1 && s === 'new' && o === 'on' && !guide) errors.push(`no guide on the default view: ${url}`);
  if (guide) await click('[data-guide-x]');  // closes the guide; the strip shows its icons again
  for (const sel of ['[data-point="editor"]', '[data-goal="0"]']) {
    if (await page.locator(`#stage ${sel}`).count()) await click(sel);
  }
  for (const id of ids) {
    if (await page.locator(`#stage .tl > [data-act="${id}"][aria-disabled="true"]:visible`).count()) continue;
    let el = page.locator(`#stage .tl > [data-act="${id}"]:visible`);
    if (!(await el.count())) {
      await page.locator('#stage [data-more]:visible').click();
      el = page.locator(`#stage .menu-pop [data-act="${id}"]:not([disabled])`);
      if (!(await el.count())) { await page.keyboard.press('Escape'); continue; }
    }
    await el.first().click();
    pressed++;
    await page.waitForTimeout(30);
    await page.keyboard.press('Escape');
    const pane = page.locator('#stage .pane [data-act="editor"]');
    if (d === 'phone' && (await pane.count())) await pane.click();
  }
  // The guide: from the strip where there is one, else from ⋯; walk it and close it.
  if (v > 1) {
    await page.goto(url);
    await page.waitForSelector('.app');
    if (await page.locator('#stage .coach.guide').count()) await click('[data-guide-x]');
    if (await page.locator('#stage [data-explain]').count()) await click('[data-explain]');
    else { await click('[data-more]'); await click('.menu-pop [data-act="help"]'); }
    if (!(await page.locator('#stage .coach.guide').count())) errors.push(`guide did not open: ${url}`);
    if (v === 4) for (let i = 0; i < 7; i++) await click('[data-step="1"]');
    await click('[data-guide-ok]');
    if (await page.locator('#stage .coach.guide, #stage .strip').count()) errors.push(`guide or strip stayed: ${url}`);
    // The shortcuts the guide teaches work.
    if (d === 'desktop') {
      await page.keyboard.press('Control+Alt+KeyT');
      if (!(await page.locator('#stage .term').count())) errors.push(`Ctrl+Alt+T: ${url}`);
      pressed++;
    }
  } else if (await page.locator('#stage [data-explain]').count()) {
    await click('[data-explain]');
    await click('[data-send]');
    await page.waitForSelector('#stage .msg-agent ul', { timeout: 3000 });
  }
}
console.log(`${pressed} presses`);
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'console clean');
await browser.close();
