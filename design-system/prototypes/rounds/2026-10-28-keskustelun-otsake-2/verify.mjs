// Builds round 2 into its issue and checks it offline. Both directions with both chip names
// ("Opus 5.5", "Opus") and round 1's Lyhenee for comparison, at 1024, 1280, 1600 and 1920 px with the
// sidebar open and closed, with the editor open, and with the content of Jari's screenshot; on a
// 390 px phone; dark and light. On the desktop the header is one row, nothing overlaps or overflows,
// the title keeps at least 40 % of the row or its whole text, the Git chip never shows the branch
// name and the model chip shows only the short name (and in direction 2 the meter). Opens the model
// and Git layers, the ⋯ menu and the activity tooltip (hover, keyboard focus, tap). Writes
// evidence/metrics.json and screenshots at device scale factor 2. No console errors or network
// requests; the picker passes picker-check.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-10-28-keskustelun-otsake-2/verify.mjs
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

const dir = path.join(root, 'issues/proto-conversation-header/prototypes/conversation-header-2');
const file = path.join(dir, 'index.html');
const out = path.join(dir, 'evidence');
execFileSync('node', [path.join(here, 'build.mjs'), '--out', file], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });

const NAMES = ['1-avattaessa', '2-mittari', 'kierros1'];
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
    const kids = [...top.children].filter(el => el.getClientRects().length);
    const rects = kids.map(el => el.getBoundingClientRect());
    const tops = rects.map(r => Math.round(r.top + r.height / 2));
    const rows = tops.reduce((acc, y) => (acc.some(a => Math.abs(a - y) <= 6) ? acc : [...acc, y]), []).length;
    let overlap = null;
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      if (a.width && b.width && a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5)
        overlap = `${kids[i].className} × ${kids[j].className}`;
    }
    const hr = hdr.getBoundingClientRect();
    const offscreen = kids.filter(el => { const r = el.getBoundingClientRect(); return r.right > hr.right + 0.5 || r.left < hr.left - 0.5; }).map(el => el.className);
    const vis = el => !!el && el.getClientRects().length > 0;
    const git = top.querySelector('[data-k="git"]'), model = top.querySelector('[data-k="model"]');
    const w = el => vis(el) ? Math.round(el.getBoundingClientRect().width) : 0;
    return {
      header: Math.round(hr.height), row: top.clientWidth, title: t.clientWidth, titleNatural: t.scrollWidth,
      rows, overflow: top.scrollWidth > top.clientWidth + 1, overlap, offscreen,
      gitText: vis(git) ? git.innerText.replace(/\s+/g, ' ').trim() : null, gitWidth: w(git),
      modelText: vis(model) ? model.innerText.replace(/\s+/g, ' ').trim() : null, modelWidth: w(model),
      meter: vis(model?.querySelector('.meter')),
      shown: ['ws', 'status', 'git', 'ctx', 'model', 'files', 'retitle', 'archive', 'info'].filter(k => vis(top.querySelector(`[data-k="${k}"]`))),
      level: document.getElementById('readout').textContent.split('·').slice(2).join('·').trim(),
    };
  });
}

async function load(v, o) {
  await page.setViewportSize({ width: +o.w, height: HEIGHTS[o.w] });
  await page.goto(url(v, o));
  await page.waitForFunction(() => document.querySelector('#frame .hdr') && document.getElementById('readout').textContent);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(80);
}

function caseName(v, o) {
  return [NAMES[v], v < 2 && o.n === 'perhe' ? 'opus' : '', o.w === '390' ? 'puhelin' : o.w,
    o.w !== '390' && o.sb === '0' ? 'kiinni' : '', o.ed === '1' ? 'editori' : '',
    o.c === 'lyhyt' ? 'lyhyt' : o.c === 'puhdas' ? 'puhdas' : '', o.th && o.th !== 'medium' ? o.th : '', o.o ? 'auki-' + o.o : '',
    o.t === 'light' ? 'vaalea' : 'tumma'].filter(Boolean).join('-');
}

async function run(v, o, { full = false } = {}) {
  o = { sb: '1', ed: '0', n: 'versio', th: 'medium', c: 'pitka', o: '', t: 'dark', ...o };
  await load(v, o);
  const m = await measure();
  const name = caseName(v, o);
  metrics.push({ variant: NAMES[v], ...o, ...m, shot: name });
  if (full) await page.screenshot({ path: path.join(out, name + '.png') });
  else {
    const box = await page.locator('#frame .conv > .hdr').boundingBox();
    const conv = await page.locator('#frame .conv').boundingBox();
    await page.screenshot({ path: path.join(out, 'otsake-' + name + '.png'), clip: { x: conv.x, y: box.y, width: conv.width, height: box.height + 1 } });
  }
  if (v < 2 && o.w !== '390') {
    const need = Math.min(m.titleNatural, m.row * 0.4) - 1.5;
    if (m.rows !== 1) failures.push(`${name}: ${m.rows} rows`);
    if (m.overflow) failures.push(`${name}: header row overflows`);
    if (m.overlap) failures.push(`${name}: overlap ${m.overlap}`);
    if (m.offscreen.length) failures.push(`${name}: off the header ${m.offscreen}`);
    if (m.title < need) failures.push(`${name}: title ${m.title} px < ${Math.round(need)} px`);
  }
  if (v < 2) {
    if (m.gitText && /[a-z]{2}/i.test(m.gitText)) failures.push(`${name}: Git chip shows text "${m.gitText}"`);
    const short = o.n === 'perhe' ? 'Opus' : 'Opus 5.5';
    if (m.modelText !== null && m.modelText !== short) failures.push(`${name}: model chip "${m.modelText}"`);
    if (v === 0 && m.meter) failures.push(`${name}: meter in direction 1`);
    if (v === 1 && m.modelText !== null && !m.meter && !/taso [78]/.test(m.level)) failures.push(`${name}: meter missing`);
  }
  if (o.w === '390' && (m.overlap || m.offscreen.length)) failures.push(`${name}: ${m.overlap ?? ''} ${m.offscreen}`);
  return m;
}

// Header strips: every width, sidebar open and closed, editor open, Jari's content.
for (let v = 0; v < 3; v++) {
  for (const n of v < 2 ? ['versio', 'perhe'] : ['versio']) {
    for (const w of ['1024', '1280', '1600', '1920']) {
      for (const sb of ['1', '0']) await run(v, { w, sb, n });
      await run(v, { w, ed: '1', n });
      await run(v, { w, c: 'lyhyt', n });
    }
    await run(v, { w: '1280', c: 'puhdas', n });
    await run(v, { w: '1280', n, t: 'light' });
  }
  // Full frames: the common laptop case in both themes, the editor, the phone.
  await run(v, { w: '1280' }, { full: true });
  await run(v, { w: '1280', t: 'light' }, { full: true });
  await run(v, { w: '1600', ed: '1' }, { full: true });
  for (const t of ['dark', 'light']) await run(v, { w: '390', t }, { full: true });
}
// Thinking levels on the meter (direction 2).
for (const th of ['off', 'low', 'high', 'max']) await run(1, { w: '1280', sb: '0', th });

// Opened layers, full frames.
async function opened(v, o, kind, check) {
  o = { sb: '1', ed: '0', n: 'versio', th: 'medium', c: 'pitka', t: 'dark', ...o, o: kind };
  await load(v, o);
  await page.waitForTimeout(250);
  const layer = page.locator(`#frame [data-layer="${kind}"]`);
  assert.ok(await layer.isVisible(), `${caseName(v, o)}: ${kind} layer opens`);
  const box = await layer.boundingBox(), conv = await page.locator('#frame .conv').boundingBox();
  if (box.x < conv.x - 1 || box.x + box.width > conv.x + conv.width + 1 || box.y + box.height > conv.y + conv.height + 1)
    failures.push(`${caseName(v, o)}: ${kind} layer leaves the column`);
  await check?.(layer);
  await page.screenshot({ path: path.join(out, caseName(v, o) + '.png') });
}
const hasText = s => async layer => assert.ok((await layer.textContent()).includes(s), `layer has "${s}"`);
for (const v of [0, 1]) for (const t of ['dark', 'light']) {
  await opened(v, { w: '1280', t }, 'model', async layer => {
    await hasText('Ajattelutaso')(layer);
    assert.equal(await layer.locator('[aria-label="Ajattelutasot"] [aria-current="true"]').textContent(), 'Medium');
  });
}
await opened(0, { w: '1280', n: 'perhe' }, 'model', hasText('Opus 5.5'));
await opened(1, { w: '1024' }, 'model', hasText('Ajattelutaso'));
for (const c of ['pitka', 'lyhyt', 'puhdas']) await opened(0, { w: '1280', c }, 'git', hasText(c === 'pitka' ? 'wt/korjaa-otsikkorivin-tilanjako-kapeassa-keskustelusarakkeessa' : 'main'));
await opened(0, { w: '1280', t: 'light' }, 'git', hasText('seurantahaara'));
await opened(0, { w: '1600', ed: '1' }, 'git', hasText('wt/korjaa'));
await opened(0, { w: '1600', ed: '1' }, 'menu', hasText('Arkistoi'));
for (const kind of ['model', 'git']) await opened(1, { w: '390' }, kind, hasText(kind === 'git' ? 'wt/korjaa' : 'Ajattelutaso'));

// Activity tooltip: hover, keyboard focus and tap each show the state; the name always carries it.
const ACT = 'Työskentelee · Ajattelee · 2 min 14 s';
await load(0, { w: '1920', sb: '0', ed: '0', n: 'versio', th: 'medium', c: 'lyhyt', o: '', t: 'dark' });
const dot = page.locator('#frame .h-status');
assert.equal(await dot.getAttribute('aria-label'), ACT, 'dot accessible name');
const tipShown = () => page.locator('#frame .h-status .tip').evaluate(el => getComputedStyle(el).opacity === '1');
await dot.hover(); await page.waitForTimeout(200);
assert.ok(await tipShown(), 'tooltip on hover');
await page.screenshot({ path: path.join(out, 'tila-vihje-hover-1920-tumma.png'), clip: { x: 600, y: 0, width: 1320, height: 120 } });
await page.mouse.move(5, 500); await page.waitForTimeout(200);
assert.ok(!(await tipShown()), 'tooltip hides');
await page.locator('#frame .h-ws').focus(); await page.keyboard.press('Tab'); await page.waitForTimeout(200);
assert.ok(await dot.evaluate(el => el === document.activeElement), 'dot takes keyboard focus');
assert.ok(await tipShown(), 'tooltip on keyboard focus');
await page.locator('#frame .h-ws').focus();
await load(1, { w: '390', sb: '1', ed: '0', n: 'versio', th: 'medium', c: 'pitka', o: '', t: 'light' });
await page.locator('#frame .h-status').click(); await page.waitForTimeout(200);
assert.ok(await page.locator('#frame .h-status .tip').evaluate(el => getComputedStyle(el).opacity === '1'), 'tooltip on tap');
await page.screenshot({ path: path.join(out, '2-mittari-puhelin-tila-napautus-vaalea.png') });

// Clicking the chip opens and closes its layer (the URL route is not the only way in).
await load(0, { w: '1280', sb: '1', ed: '0', n: 'versio', th: 'medium', c: 'pitka', o: '', t: 'dark' });
await page.click('#frame [data-k="git"]'); await page.waitForTimeout(200);
assert.ok(await page.locator('#frame [data-layer="git"]').isVisible(), 'git chip click opens');
await page.keyboard.press('Escape');
assert.ok(!(await page.locator('#frame [data-layer="git"]').isVisible()), 'Escape closes');

// Picker, with the chrome on.
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(pathToFileURL(file).href + '?v=2');
await page.waitForFunction(() => document.querySelector('#frame .hdr'));
await checkPicker(page, '2026-10-28-keskustelun-otsake-2');
await page.waitForTimeout(150);
await page.screenshot({ path: path.join(out, 'sivu-ohjaimineen-1440.png') });

await browser.close();
writeFileSync(path.join(out, 'metrics.json'), JSON.stringify(metrics, null, 1) + '\n');
assert.deepEqual(errors, [], 'console errors');
assert.deepEqual(requests, [], 'network requests');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`ok: ${metrics.length} cases, evidence in ${path.relative(root, out)}`);
