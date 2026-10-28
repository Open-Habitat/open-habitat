// Builds index.html and checks it offline: every direction at 1440 and 390 px, light and dark.
// Markdown scrolled to its middle: ⌘E (Ctrl+E) shows the preview in place of the text at the
// same section with focus on it, Esc returns to where the reading was, ⌘⇧V toggles too, and the
// direction's own icons open and close it. CSV opens as a table at the same row. SVG is an
// image, HTML an inert frame, JSON has no row and ignores the keys. No horizontal overflow, the
// picker holds, no console errors or network requests. Screenshots at device scale factor 2.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright NODE_PATH=<checkout>/web/node_modules \
//     node issues/proto-markdown-full-preview-button/prototypes/full-preview-icons/verify.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const { checkPicker } = await import(path.join(root, 'design-system/prototypes/picker-check.mjs'));
const req = createRequire(existsSync(path.join(root, 'web/node_modules')) ? path.join(root, 'web/package.json') : path.join(process.env.NODE_PATH || '', 'x.js'));
const { chromium } = req('@playwright/test');

execFileSync('node', [path.join(here, 'build.mjs')], { stdio: 'inherit' });
const page = path.join(here, 'index.html');
const out = path.join(here, 'evidence');
mkdirSync(out, { recursive: true });
for (const f of readdirSync(out)) if (f.endsWith('.png')) unlinkSync(path.join(out, f));

const NAMES = ['tiedostorivi', 'otsikkopalkki', 'kulma'];
const V = ['row', 'head', 'corner'];
const browser = await chromium.launch();
const errors = [], requests = [];
const watch = (p) => {
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
};
const ready = (p, v) => p.waitForFunction((d) => document.querySelector('.app')?.dataset.v === d && !!document.querySelector('.rows .ln'), V[v]);
const pick = async (p, v) => { await p.locator('.proto-picker-item').nth(v).click(); await ready(p, v); await p.waitForTimeout(100); };
async function shoot(p, file) {
  await p.locator('.proto-picker').evaluate(n => { n.style.visibility = 'hidden'; });
  await p.locator('.frame').screenshot({ path: path.join(out, file) });
  await p.locator('.proto-picker').evaluate(n => { n.style.visibility = ''; });
}
const mode = (p) => p.evaluate(() => window.__pv.S.mode);
async function noOverflow(p, tag) {
  for (const sel of ['.frame', '.ed-head', '.ed-tools']) {
    const loc = p.locator(sel).first();
    assert.ok(await loc.evaluate(n => n.scrollWidth <= n.clientWidth + 1), `${tag}: ${sel} overflows`);
  }
}
const setFile = async (p, f) => { await p.selectOption('[data-set="file"]', f); await p.waitForFunction((f) => document.querySelector('.app')?.dataset.file === f, f); };
const scrollSrcToLine = (p, i) => p.evaluate((i) => { document.querySelector('.src').scrollTop = document.querySelectorAll('.rows .ln')[i].offsetTop; }, i);
const scrollSrcTo = (p, h) => p.evaluate((h) => { const r = [...document.querySelectorAll('.rows .ln')].find(r => r.textContent === h); document.querySelector('.src').scrollTop = r.offsetTop; }, h);
const srcTopLine = (p) => p.evaluate(() => { const s = document.querySelector('.src'); return [...document.querySelectorAll('.rows .ln')].find(r => r.offsetTop + r.offsetHeight > s.scrollTop + 2)?.textContent; });
const pvTopHeading = (p) => p.evaluate(() => {
  const pv = document.querySelector('.pv'); const top = pv.getBoundingClientRect().top;
  const hs = [...pv.querySelectorAll('h2,h3')];
  return hs.reduce((b, h) => Math.abs(h.getBoundingClientRect().top - top) < Math.abs(b.getBoundingClientRect().top - top) ? h : b).textContent;
});
const pvTopRow = (p) => p.evaluate(() => {
  const pv = document.querySelector('.pv'); const head = pv.querySelector('thead th').getBoundingClientRect().bottom;
  return +[...pv.querySelectorAll('tbody tr')].find(r => r.getBoundingClientRect().top >= head - 2).dataset.line;
});
const focusText = (p) => p.locator('.code textarea').focus();
// The direction's own control: "open" and "back to text".
const openSel = (v) => v === 1 ? '[data-act="toggle"]' : '[data-act="preview"]';
const backSel = (v) => v === 1 ? '[data-act="toggle"]' : '[data-act="text"]';

let cases = 0;
try {
  for (const [width, size] of [[1440, 'desktop'], [390, 'phone']]) for (const theme of ['light', 'dark']) {
    const p = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: 'reduce' });
    watch(p);
    await p.goto('file://' + page);
    await p.selectOption('#theme', theme);
    await p.evaluate(() => document.fonts.ready);
    await checkPicker(p, 'proto-markdown-full-preview-button-r2');
    for (let v = 0; v < 3; v++) {
      const tag = `${NAMES[v]} ${size} ${theme}`;
      const n = `${v + 1}-${NAMES[v]}-${size === 'phone' ? 'puhelin' : 'tyopoyta'}`;
      const light = theme === 'light', desk = size === 'desktop';
      await pick(p, v);
      await p.selectOption('[data-set="kbd"]', 'mac');
      await setFile(p, 'md');
      await noOverflow(p, tag);
      assert.ok(await p.locator(openSel(v)).isVisible(), `${tag}: own control visible`);
      // Markdown in the middle; ⌘E opens the preview at the same section, focus on it.
      await scrollSrcTo(p, '## Majoitus'); await focusText(p); await scrollSrcTo(p, '## Majoitus');
      if (light) await shoot(p, `${n}-md-teksti.png`);
      await p.keyboard.press('Control+KeyE');
      assert.equal(await mode(p), 'preview', `${tag}: ⌘E opens`);
      assert.ok(!(await p.locator('.src').isVisible()), `${tag}: text hidden`);
      assert.equal(await pvTopHeading(p), 'Majoitus', `${tag}: same section`);
      assert.ok(await p.evaluate(() => document.activeElement?.classList.contains('pv')), `${tag}: focus on preview`);
      assert.equal(await p.locator(openSel(v)).getAttribute('aria-pressed'), 'true', `${tag}: pressed`);
      await noOverflow(p, tag + ' preview');
      if (light || desk) await shoot(p, `${n}-md-esikatselu${light ? '' : '-tumma'}.png`);
      // Arrow keys in the preview scroll it and do not switch the direction.
      await p.keyboard.press('ArrowRight');
      assert.equal(await p.evaluate(() => document.querySelector('.app').dataset.v), V[v], `${tag}: arrow stays in the preview`);
      // Read on; Esc returns to where the reading was.
      await p.locator('.pv').evaluate(pv => { pv.scrollTop = [...pv.querySelectorAll('h2')].find(h => h.textContent === 'Huolto').offsetTop - pv.firstElementChild.offsetTop; });
      await p.keyboard.press('Escape');
      assert.equal(await mode(p), 'text', `${tag}: Esc`);
      assert.equal(await srcTopLine(p), '## Huolto', `${tag}: text where the reading was`);
      assert.ok(await p.evaluate(() => document.activeElement?.matches('.code textarea')), `${tag}: focus back in text`);
      // ⌘⇧V toggles as before.
      await p.keyboard.press('Control+Shift+KeyV'); assert.equal(await mode(p), 'preview', `${tag}: ⌘⇧V opens`);
      await p.keyboard.press('Control+Shift+KeyV'); assert.equal(await mode(p), 'text', `${tag}: ⌘⇧V closes`);
      // The own control.
      await p.locator(openSel(v)).click(); assert.equal(await mode(p), 'preview', `${tag}: control opens`);
      await p.locator(backSel(v)).click(); assert.equal(await mode(p), 'text', `${tag}: control returns`);
      if (light && desk) {
        await p.locator(openSel(v)).hover(); await p.waitForTimeout(120);
        await shoot(p, `${n}-vihje.png`); await p.mouse.move(5, 5);
      }
      // CSV: a table at the same row.
      await setFile(p, 'csv');
      await scrollSrcToLine(p, 12); await focusText(p); await scrollSrcToLine(p, 12);
      await p.keyboard.press('Control+KeyE');
      assert.equal(await mode(p), 'preview', `${tag}: csv opens`);
      assert.ok(await p.locator('.pv-csv thead th').count() > 5, `${tag}: csv table`);
      assert.equal(await pvTopRow(p), 12, `${tag}: csv same row`);
      assert.equal(await p.locator(openSel(v)).getAttribute('aria-label'), 'Taulukko', `${tag}: csv label`);
      await noOverflow(p, tag + ' csv');
      if ((light && desk) || (!light && !desk)) await shoot(p, `${n}-csv-taulukko${light ? '' : '-tumma'}.png`);
      await p.keyboard.press('Escape');
      assert.equal(await srcTopLine(p), (await p.evaluate(() => window.FILES.csv.split('\n')[12])), `${tag}: csv back at the row`);
      // SVG and HTML.
      await setFile(p, 'svg'); await focusText(p); await p.keyboard.press('Control+KeyE');
      assert.ok(await p.locator('.pv-img img').evaluate(i => i.complete && i.naturalWidth > 0), `${tag}: svg drawn`);
      if (v === 0 && light && desk) await shoot(p, 'muoto-svg.png');
      await setFile(p, 'html'); await focusText(p); await p.keyboard.press('Control+KeyE');
      assert.equal(await p.locator('.pv-html iframe').getAttribute('sandbox'), '', `${tag}: html inert`);
      if (v === 0 && light && desk) { await p.waitForTimeout(200); await shoot(p, 'muoto-html.png'); }
      // JSON: no row, the keys do nothing.
      await setFile(p, 'json'); await focusText(p);
      assert.equal(await p.locator('[data-act="preview"], [data-act="toggle"], [data-act="text"]').count(), 0, `${tag}: json has no row`);
      await p.keyboard.press('Control+KeyE'); assert.equal(await mode(p), 'text', `${tag}: json ignores keys`);
      if (v === 0 && light && desk) await shoot(p, 'muoto-json.png');
      // Phone: the text with its control in reach.
      if (!desk && light) { await setFile(p, 'md'); await scrollSrcTo(p, '## Majoitus'); await shoot(p, `${n}-md-teksti.png`); }
      // Conversation beside: the narrow pane keeps the control.
      if (desk && light) {
        await setFile(p, 'md'); await p.selectOption('[data-set="conv"]', '1');
        await p.locator(openSel(v)).click(); assert.equal(await mode(p), 'preview', `${tag}: beside conversation`);
        await noOverflow(p, tag + ' conversation');
        await shoot(p, `${n}-keskustelu-rinnalla.png`);
        await p.selectOption('[data-set="conv"]', '0');
      }
      cases++;
    }
    await p.close();
  }
  // The HTML file's own script is refused by the sandbox: that message is the inert frame working.
  const blocked = errors.filter(e => /^Blocked script execution in 'about:srcdoc'/.test(e));
  assert.ok(blocked.length > 0, 'the HTML preview blocked the file\'s script');
  assert.deepEqual(errors.filter(e => !blocked.includes(e)), []); assert.deepEqual(requests, []);
  console.log(`PASS: ${cases} direction×size×theme cases; ⌘E and ⌘⇧V open the preview in place at the same section/row; Esc returns where the reading was; own control; CSV table, SVG image, inert HTML (its script blocked), JSON without row; picker; no overflow, console errors or network requests.`);
} finally { await browser.close(); }
