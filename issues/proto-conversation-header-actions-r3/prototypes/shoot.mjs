// Screenshots of opastus.html at device scale factor 2, and a console check
// that presses every header control and every riff's own explanation in
// every riff, theme, device, width, situation and start-page state.
// Run: NODE_PATH=<repo>/web/node_modules node shoot.mjs <outdir>
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(path.join(process.env.NODE_PATH, 'x.js'));
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || path.join(here, 'kuvat');
const page0 = 'file://' + path.join(here, 'opastus.html');

// [name, query, steps inside #stage: a selector to click, or hover:<selector>]
const shots = [
  ['01-pohja-tyopoyta-vaalea-uusi', 'v=1&t=light&d=desktop&s=new', []],
  ['02-pohja-puhelin-tumma-uusi', 'v=1&t=dark&d=phone&s=new', []],
  ['03-riffi1-tyopoyta-vaalea-uusi', 'v=2&t=light&d=desktop&s=new', []],
  ['04-riffi1-tyopoyta-vaalea-nimet', 'v=2&t=light&d=desktop&s=new', ['[data-act="ask"]']],
  ['05-riffi1-tyopoyta-tumma-tyota-nimet', 'v=2&t=dark&d=desktop&s=first&w=narrow', ['[data-act="ask"]']],
  ['06-riffi1-puhelin-vaalea-nimet', 'v=2&t=light&d=phone&s=new', ['[data-act="ask"]']],
  ['07-riffi2-tyopoyta-vaalea-uusi', 'v=3&t=light&d=desktop&s=new', []],
  ['08-riffi2-tyopoyta-vaalea-luonnos', 'v=3&t=light&d=desktop&s=new', ['[data-askagent]']],
  ['09-riffi2-tyopoyta-tumma-vastaus', 'v=3&t=dark&d=desktop&s=new', ['[data-askagent]', '[data-send]']],
  ['10-riffi2-tyopoyta-vaalea-tyota-valikko', 'v=3&t=light&d=desktop&s=first', ['[data-more]']],
  ['11-riffi2-tyopoyta-vaalea-tyota-luonnos', 'v=3&t=light&d=desktop&s=first', ['[data-more]', '.menu-pop [data-act="askagent"]']],
  ['12-riffi2-puhelin-tumma-uusi', 'v=3&t=dark&d=phone&s=new', []],
  ['13-riffi3-tyopoyta-vaalea-uusi', 'v=4&t=light&d=desktop&s=new', []],
  ['14-riffi3-tyopoyta-vaalea-osoitus', 'v=4&t=light&d=desktop&s=new', ['hover:[data-point="terminal"]']],
  ['15-riffi3-tyopoyta-tumma-ei-aloitussivua', 'v=4&t=dark&d=desktop&s=new&p=off', []],
  ['16-riffi3-puhelin-vaalea-uusi', 'v=4&t=light&d=phone&s=new', []],
  ['17-riffi3-puhelin-tumma-vastaus', 'v=4&t=dark&d=phone&s=new', ['[data-explain]', '[data-send]']],
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
// Every riff, theme, device, width, situation and start-page state renders
// without errors; every header control can be pressed, from the row or the
// menu; and each riff's own explanation opens and closes.
const ids = ['editor', 'terminal', 'recap', 'retitle', 'rename', 'archive', 'details', 'workspace', 'help', 'ask', 'askagent'];
let pressed = 0;
for (const v of [1, 2, 3, 4]) for (const t of ['light', 'dark']) for (const d of ['desktop', 'phone']) for (const w of ['wide', 'narrow', 'xwide']) for (const s of ['new', 'first', 'later']) for (const p of ['on', 'off']) {
  if (d === 'phone' && w !== 'wide') continue;
  if (s === 'first' && p === 'off') continue;
  const url = `${page0}?v=${v}&t=${t}&d=${d}&w=${w}&s=${s}&p=${p}`;
  await page.goto(url);
  await page.waitForSelector('.app');
  const coach = page.locator('#stage [data-coach-ok]');
  if (await coach.count()) { await coach.click(); pressed++; }
  for (const sel of ['[data-point="editor"]', '[data-strip-x]', '[data-suggest-x]', '[data-goal="0"]']) {
    const el = page.locator(`#stage ${sel}`);
    if (await el.count()) { await el.click(); pressed++; await page.waitForTimeout(40); }
  }
  for (const id of ids) {
    // A button main disables in an empty conversation explains itself in its tooltip.
    if (await page.locator(`#stage .tl > [data-act="${id}"][aria-disabled="true"]:visible`).count()) continue;
    let el = page.locator(`#stage .tl > [data-act="${id}"]:visible`);
    if (!(await el.count())) {
      await page.locator('#stage [data-more]:visible').click();
      el = page.locator(`#stage .menu-pop [data-act="${id}"]:not([disabled])`);
      if (!(await el.count())) { await page.keyboard.press('Escape'); continue; }
    }
    await el.first().click();
    pressed++;
    await page.waitForTimeout(40);
    await page.keyboard.press('Escape');
    // The editor covers a phone's screen; its own × closes it.
    const pane = page.locator('#stage .pane [data-act="editor"]');
    if (d === 'phone' && (await pane.count())) await pane.click();
  }
  // The question the riffs 2 and 3 prepare can be sent and is answered.
  const sendable = page.locator('#stage [data-send]:not([disabled])');
  if (await sendable.count()) { await sendable.click(); pressed++; await page.waitForTimeout(1200); }
  for (const sel of ['[data-askagent]', '[data-explain]']) {
    await page.goto(url);
    await page.waitForSelector('.app');
    const el = page.locator(`#stage ${sel}`);
    if (!(await el.count())) continue;
    await el.click();
    await page.locator('#stage [data-send]').click();
    pressed += 2;
    await page.waitForSelector('#stage .msg-agent ul', { timeout: 3000 });
  }
}
console.log(`${pressed} presses`);
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'console clean');
await browser.close();
