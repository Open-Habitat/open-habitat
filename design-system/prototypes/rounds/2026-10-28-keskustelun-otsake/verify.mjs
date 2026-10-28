// Builds the round into its issue and checks it offline. Every variant (three directions, Nykyinen,
// Aiempi) at 1024, 1280, 1600 and 1920 px with the sidebar open and closed, with the editor open
// beside the conversation, and on a 390 px phone, in dark and light, long content and the content of
// Jari's screenshot. For the three directions on the desktop: the header is one row, nothing in it
// overlaps or overflows, and the title keeps at least 40 % of the row or its whole text. Writes the
// measurements to evidence/metrics.json, header strips for every case and full frames for a
// selection, at device scale factor 2. No console errors or network requests; the picker passes
// picker-check.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-10-28-keskustelun-otsake/verify.mjs
// A worktree without web/node_modules can point OH_WEB_PACKAGE at another checkout's web/package.json.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkPicker } from '../../picker-check.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const require = createRequire(process.env.OH_WEB_PACKAGE ?? path.join(root, 'web/package.json'));
const { chromium } = require('@playwright/test');

const dir = path.join(root, 'issues/proto-conversation-header/prototypes/conversation-header');
const file = path.join(dir, 'index.html');
const out = path.join(dir, 'evidence');
execFileSync('node', [path.join(here, 'build.mjs'), '--out', file], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });

const NAMES = ['1-lyhenee', '2-valikkoon', '3-kentan-luo', 'nykyinen', 'aiempi'];
const HEIGHTS = { 1024: 700, 1280: 800, 1600: 900, 1920: 1080, 390: 844 };
const browser = await chromium.launch();
const errors = [], requests = [], failures = [], metrics = [];
const url = (v, o) => pathToFileURL(file).href + '?' + new URLSearchParams({ v: v + 1, bare: '1', ...o });

const ctx = await browser.newContext({ deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });

async function measure() {
  return page.evaluate(() => {
    const hdr = document.querySelector('.hdr');
    const top = hdr.querySelector('.top');
    const t = hdr.querySelector('.h-title');
    const kids = [...top.children].filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
    const rects = kids.map(el => el.getBoundingClientRect());
    const rows = new Set(rects.map(r => Math.round(r.top + r.height / 2))).size;
    const tops = rects.map(r => Math.round(r.top + r.height / 2));
    const rowCount = tops.reduce((acc, y) => (acc.some(a => Math.abs(a - y) <= 6) ? acc : [...acc, y]), []).length;
    let overlap = null;
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      if (a.width && b.width && a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5)
        overlap = `${kids[i].className} × ${kids[j].className}`;
    }
    const hr = hdr.getBoundingClientRect();
    const offscreen = kids.filter(el => { const r = el.getBoundingClientRect(); return r.right > hr.right + 0.5 || r.left < hr.left - 0.5; }).map(el => el.className);
    const visible = k => { const el = top.querySelector(`[data-k="${k}"]`); return !!el && el.getClientRects().length > 0; };
    const fs = document.querySelector('.fstate');
    return {
      header: Math.round(hr.height), row: top.clientWidth, title: t.clientWidth, titleNatural: t.scrollWidth,
      rows: rowCount, overflow: top.scrollWidth > top.clientWidth + 1, overlap, offscreen, _rows: rows,
      shown: ['ws', 'status', 'git', 'ctx', 'model', 'files', 'editor', 'terminal', 'retitle', 'archive', 'info'].filter(visible),
      fstateOverflow: fs ? fs.scrollWidth > fs.clientWidth + 1 : null,
      level: document.getElementById('readout').textContent.split('·').slice(2).join('·').trim(),
    };
  });
}

async function run(v, o, { full = false } = {}) {
  const w = +o.w;
  await page.setViewportSize({ width: w, height: HEIGHTS[o.w] });
  await page.goto(url(v, o));
  await page.waitForFunction(() => document.querySelector('#frame .hdr') && document.getElementById('readout').textContent);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(80);
  const m = await measure();
  const name = `${NAMES[v]}-${o.w === '390' ? 'puhelin' : o.w}${o.w !== '390' && o.sb === '0' ? '-kiinni' : ''}${o.ed === '1' ? '-editori' : ''}${o.c === 'lyhyt' ? '-lyhyt' : ''}-${o.t === 'light' ? 'vaalea' : 'tumma'}`;
  metrics.push({ variant: NAMES[v], ...o, ...m, shot: name });
  const box = await page.locator('#frame .conv > .hdr').boundingBox();
  const conv = await page.locator('#frame .conv').boundingBox();
  if (full) await page.screenshot({ path: path.join(out, name + '.png') });
  else await page.screenshot({ path: path.join(out, 'otsake-' + name + '.png'), clip: { x: conv.x, y: box.y, width: conv.width, height: box.height + 1 } });
  if (v < 3 && o.w !== '390') {
    const where = `${name}`;
    const need = Math.min(m.titleNatural, m.row * 0.4) - 1.5;
    if (m.rows !== 1) failures.push(`${where}: ${m.rows} rows`);
    if (m.overflow) failures.push(`${where}: header row overflows`);
    if (m.overlap) failures.push(`${where}: overlap ${m.overlap}`);
    if (m.offscreen.length) failures.push(`${where}: off the header ${m.offscreen}`);
    if (m.title < need) failures.push(`${where}: title ${m.title} px < ${Math.round(need)} px`);
    if (m.fstateOverflow) failures.push(`${where}: field state line overflows`);
  }
  if (o.w === '390' && (m.overlap || m.offscreen.length)) failures.push(`${name}: ${m.overlap ?? ''} ${m.offscreen}`);
  return m;
}

for (let v = 0; v < 5; v++) {
  for (const w of ['1024', '1280', '1600', '1920']) {
    for (const sb of ['1', '0']) await run(v, { w, sb, ed: '0', c: 'pitka', t: 'dark' });
    await run(v, { w, sb: '1', ed: '1', c: 'pitka', t: 'dark' });
    await run(v, { w, sb: '1', ed: '0', c: 'lyhyt', t: 'dark' });
  }
  await run(v, { w: '1280', sb: '1', ed: '0', c: 'pitka', t: 'light' });
  // Full frames: the common laptop case in both themes, the editor, Jari's content, the phone.
  await run(v, { w: '1280', sb: '1', ed: '0', c: 'pitka', t: 'dark' }, { full: true });
  await run(v, { w: '1280', sb: '1', ed: '0', c: 'pitka', t: 'light' }, { full: true });
  await run(v, { w: '1600', sb: '1', ed: '1', c: 'pitka', t: 'dark' }, { full: true });
  await run(v, { w: '1920', sb: '1', ed: '0', c: 'lyhyt', t: 'dark' }, { full: true });
  for (const t of ['dark', 'light']) await run(v, { w: '390', sb: '1', ed: '0', c: 'pitka', t }, { full: true });
}

// The ⋯ menu of direction 2 at 1280 with the editor open, opened.
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(url(1, { w: '1280', sb: '1', ed: '1', c: 'pitka', t: 'dark' }));
await page.waitForFunction(() => document.querySelector('#frame .top.more-on'));
await page.click('#frame .h-more');
await page.waitForTimeout(300);
assert.ok(await page.locator('#frame .h-menu').isVisible(), 'direction 2: menu opens');
assert.ok((await page.locator('#frame .h-menu').textContent()).includes('Konteksti'), 'direction 2: hidden context is in the menu');
await page.screenshot({ path: path.join(out, '2-valikkoon-1280-editori-valikko-tumma.png') });

// Picker, with the chrome on.
await page.goto(pathToFileURL(file).href + '?v=1');
await page.waitForFunction(() => document.querySelector('#frame .hdr'));
await checkPicker(page, '2026-10-28-keskustelun-otsake');
await page.keyboard.press('3');
await page.waitForFunction(() => document.querySelector('#frame .fstate'));
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(150);
await page.screenshot({ path: path.join(out, 'sivu-ohjaimineen-1440.png') });

await browser.close();
writeFileSync(path.join(out, 'metrics.json'), JSON.stringify(metrics, null, 1) + '\n');
assert.deepEqual(errors, [], 'console errors');
assert.deepEqual(requests, [], 'network requests');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`ok: ${metrics.length} cases, evidence in ${path.relative(root, out)}`);
