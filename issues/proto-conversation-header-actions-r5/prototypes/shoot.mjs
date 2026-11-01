// Screenshots of selitystila.html at device scale factor 2, and a check that
// explains every part of the screen in every riff, theme, device, width,
// situation and start-page state, presses every header control, and starts
// and ends the mode from the strip, from ⋯ and with Esc.
// Run: NODE_PATH=<repo>/web/node_modules node shoot.mjs <outdir>
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(path.join(process.env.NODE_PATH, 'x.js'));
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || path.join(here, 'kuvat');
const only = process.argv[3];   // 'shots' or 'check' runs only that half
const page0 = 'file://' + path.join(here, 'selitystila.html');

// [name, query, steps inside #stage: a selector to click, or hover:<selector>]
const shots = [
  ['01-pohja-tyopoyta-vaalea', 'v=1&t=light&d=desktop&s=new', []],
  ['02-riffi1-tyopoyta-vaalea', 'v=2&t=light&d=desktop&s=new', []],
  ['03-riffi1-sivupalkki-tumma', 'v=2&t=dark&d=desktop&s=new', ['hover:[data-x="row:1"]']],
  ['04-riffi1-kiinnitetty-vaalea', 'v=2&t=light&d=desktop&s=new', ['[data-x="mic"]']],
  ['05-riffi1-kapea-valikko-vaalea', 'v=2&t=light&d=desktop&w=narrow&s=new', ['[data-x="more"]']],
  ['06-riffi1-puhelin-vaalea', 'v=2&t=light&d=phone&s=new', []],
  ['07-riffi1-puhelin-tavoite-tumma', 'v=2&t=dark&d=phone&s=new', ['[data-x="goal:0"]']],
  ['08-riffi1-tyota-valikosta-vaalea', 'v=2&t=light&d=desktop&s=first', ['[data-more]', '.menu-pop [data-act="help"]', 'hover:[data-x="tool"]']],
  ['09-riffi2-tyopoyta-vaalea', 'v=3&t=light&d=desktop&s=new', []],
  ['10-riffi2-paate-auki-tumma', 'v=3&t=dark&d=desktop&s=new', ['[data-act="terminal"]', 'hover:[data-x="termpane"]']],
  ['11-riffi2-kapea-valikko-vaalea', 'v=3&t=light&d=desktop&w=narrow&s=first', ['[data-more]', '.menu-pop [data-act="help"]', '[data-more]', 'hover:.menu-pop [data-x="recap"]']],
  ['12-riffi2-puhelin-vaalea', 'v=3&t=light&d=phone&s=new', []],
  ['13-riffi2-puhelin-kentta-tumma', 'v=3&t=dark&d=phone&s=new', ['[data-x="field"]']],
  ['14-riffi3-tyopoyta-vaalea', 'v=4&t=light&d=desktop&s=new', []],
  ['15-riffi3-kaikki-nimet-tumma', 'v=4&t=dark&d=desktop&s=new', ['[data-xm-all]']],
  ['16-riffi3-kapea-vaalea', 'v=4&t=light&d=desktop&w=narrow&s=new', ['hover:[data-x="more"]']],
  ['17-riffi3-puhelin-vaalea', 'v=4&t=light&d=phone&s=new', []],
  ['18-ennen-painamista-vaalea', 'v=2&t=light&d=desktop&s=new&o=off', []],
];

const browser = await chromium.launch();
// Tall enough that nothing scrolls: a hover stays where the pointer is.
const ctx = await browser.newContext({ viewport: { width: 1780, height: 2600 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
if (only !== 'check') for (const [name, query, steps] of shots) {
  await page.goto(`${page0}?${query}`);
  await page.waitForSelector('.app');
  await page.waitForTimeout(150);
  for (const sel of steps) {
    if (sel.startsWith('hover:')) await page.hover(`#stage ${sel.slice(6)}`);
    else await page.click(`#stage ${sel}`);
    await page.waitForTimeout(300);
  }
  await page.locator('.app-wrap').screenshot({ path: path.join(out, `${name}.png`) });
  console.log(name);
}
if (only === 'shots') { await browser.close(); process.exit(0); }

const ids = ['editor', 'terminal', 'recap', 'retitle', 'rename', 'archive', 'details', 'workspace', 'help'];
let pressed = 0, explained = 0;
const click = async (sel) => { await page.locator(`#stage ${sel}`).first().click(); pressed++; await page.waitForTimeout(30); };
// The explanation is on screen and inside the app.
async function explainedOk(url, key) {
  const box = await page.evaluate(() => {
    const app = document.querySelector('#stage .app').getBoundingClientRect();
    const c = document.querySelector('#stage .xm-card, #stage .xm-dock-b');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { in: r.left >= app.left - 1 && r.right <= app.right + 1 && r.top >= app.top - 1 && r.bottom <= app.bottom + 1, hot: document.querySelector('#stage .xm-card h2, #stage .xm-dock-c h2')?.textContent };
  });
  if (!box) errors.push(`no explanation for ${key}: ${url}`);
  else if (!box.in) errors.push(`explanation outside the app for ${key}: ${url}`);
  explained++;
}
for (const v of [1, 2, 3, 4]) for (const t of ['light', 'dark']) for (const d of ['desktop', 'phone']) for (const w of ['wide', 'narrow', 'xwide']) for (const s of ['new', 'first', 'later']) for (const p of ['on', 'off']) for (const o of ['on', 'off']) {
  if (d === 'phone' && w !== 'wide') continue;
  if (s === 'first' && p === 'off') continue;
  if (s !== 'new' && o === 'off') continue;
  if (t === 'dark' && p === 'off') continue;
  const url = `${page0}?v=${v}&t=${t}&d=${d}&w=${w}&s=${s}&p=${p}&o=${o}`;
  await page.goto(url);
  await page.waitForSelector('.app');
  const shows = s === 'new' && o === 'on';
  if (v === 1 && shows && !(await page.locator('#stage .coach.guide').count())) errors.push(`no guide on the default view: ${url}`);
  if (v > 1 && shows !== !!(await page.locator('#stage .xm-layer').count())) errors.push(`mode ${shows ? 'missing' : 'on'} on the default view: ${url}`);
  if (v > 1) {
    if (!shows) {
      if (await page.locator('#stage [data-explain]').count()) await click('[data-explain]');
      else { await click('[data-more]'); await click('.menu-pop [data-act="help"]'); }
      if (!(await page.locator('#stage .xm-layer').count())) errors.push(`mode did not start: ${url}`);
    }
    // Every part in scope explains itself: hover on a desktop, tap on a phone.
    const keys = await page.evaluate((v) => [...document.querySelectorAll('#stage .app [data-x]')]
      .filter((el) => el.getBoundingClientRect().width > 0 && (v !== 4 || el.closest('.hd'))).map((el) => el.dataset.x), v);
    for (const key of keys) {
      const sel = `.app [data-x="${key}"]`;
      if (d === 'phone') { await page.locator(`#stage ${sel}`).first().click({ force: true }); pressed++; await page.waitForTimeout(30); } else { await page.hover(`#stage ${sel}`); await page.waitForTimeout(20); }
      await explainedOk(url, key);
      if (d === 'phone' && v !== 3 && (await page.locator('#stage .xm-card [data-xm-x]').count())) await click('.xm-card [data-xm-x]');
    }
    // Riffs 1 and 3: a press pins the card and Kokeile does the thing.
    if (v !== 3) {
      await click('.app [data-x="terminal"]');
      if (!(await page.locator('#stage .xm-card.pinned [data-xm-try]').count())) errors.push(`no Kokeile: ${url}`);
      else { await click('.xm-card [data-xm-try]'); if (!(await page.locator('#stage .term').count()) || await page.locator('#stage .xm-layer').count()) errors.push(`Kokeile did not open the terminal and end the mode: ${url}`); }
    } else {
      // Riff 2: buttons act while the mode stays.
      await click('.app [data-act="terminal"]');
      if (d === 'phone') await click('.app [data-act="terminal"]');
      if (!(await page.locator('#stage .term').count()) || !(await page.locator('#stage .xm-layer').count())) errors.push(`terminal did not open inside the mode: ${url}`);
      await page.keyboard.press('Escape');
    }
    if (await page.locator('#stage .xm-layer').count()) errors.push(`Esc did not end the mode: ${url}`);
    if (v === 4) { await click('[data-more]'); await click('.menu-pop [data-act="help"]'); await click('[data-xm-all]'); if (!(await page.locator('#stage .xm-layer .lbl').count())) errors.push(`no names: ${url}`); await click('[data-xm-end]'); }
  } else if (await page.locator('#stage .coach.guide').count()) await click('[data-guide-x]');
  // Every header control still works outside the mode.
  await page.goto(url.replace(/o=on/, 'o=off'));
  await page.waitForSelector('.app');
  if (await page.locator('#stage .coach.guide').count()) await click('[data-guide-x]');
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
    if (await page.locator('#stage .xm-layer').count()) await click('[data-xm-end]');
    const pane = page.locator('#stage .pane [data-act="editor"]');
    if (d === 'phone' && (await pane.count())) await pane.click();
  }
  if (d === 'desktop') {
    await page.keyboard.press('Control+Alt+KeyT');
    pressed++;
  }
}
console.log(`${pressed} presses, ${explained} explanations`);
console.log(errors.length ? `errors:\n${[...new Set(errors)].slice(0, 60).join('\n')}\n(${errors.length} in all)` : 'console clean');
await browser.close();
