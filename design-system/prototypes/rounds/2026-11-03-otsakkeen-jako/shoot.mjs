// Builds the round and checks it offline: every direction and today, at 390, 360
// and 1440 px, light and dark, in a new and a running conversation. In each
// direction the header is one row with every item inside it, the model shows
// once (in the composer), no one-off action stays in the row, and ⋯ opens grouped
// by role with everything the row left out: Git, context, the panels and the
// workspace. No console errors, no network, picker-check passes. Writes
// metrics.json and every view to ../../dist/otsakkeen-jako-check/, and the chosen
// DSF-2 screenshots to the issue's prototype-2/kuvat/ (PNG;
// scripts/screenshots-to-avif.py converts them).
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-11-03-otsakkeen-jako/shoot.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkPicker } from '../../picker-check.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const require = createRequire(path.join(root, 'web/package.json'));
const { chromium } = require('@playwright/test');
const issue = path.join(root, 'issues/phone-header-second-row-uneven/prototype-2');
const file = path.join(issue, 'otsakkeen-jako.html');
const all = path.join(root, 'design-system/prototypes/dist/otsakkeen-jako-check');
const kuvat = path.join(issue, 'kuvat');
execFileSync('node', [path.join(here, 'build.mjs'), '--out', file], { stdio: 'inherit' });
mkdirSync(all, { recursive: true });
mkdirSync(kuvat, { recursive: true });

const NAMES = ['1-tyokalut', '2-tila', '3-pelkka-otsikko', 'nyt'];
const FI = { light: 'vaalea', dark: 'tumma' };
// Screenshots Jari gets, per direction: [width, theme, situation, menu open].
const KEEP = [
  [390, 'light', 'uusi', false], [390, 'light', 'kaynnissa', false], [390, 'dark', 'kaynnissa', true],
  [1440, 'dark', 'uusi', false], [1440, 'light', 'kaynnissa', false], [1440, 'light', 'kaynnissa', true],
];
// What each direction keeps in the row; everything else of these is in ⋯.
const ROW = {
  '1-tyokalut': ['editor', 'terminal'],
  '2-tila': ['git', 'context'],
  '3-pelkka-otsikko': [],
};
const SEL = { git: '.ah-gs-chip', context: '.ah-ctx-chip', editor: '.ah-editor-controls', terminal: '.ah-terminal-toggle' };

const browser = await chromium.launch();
const errors = [], requests = [], metrics = [];
let shot = 1;
for (const width of [390, 360, 1440]) {
  const ctx = await browser.newContext({ viewport: { width, height: width > 800 ? 900 : 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', (r) => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
  if (width === 390) {
    await page.goto(pathToFileURL(file).href);
    await checkPicker(page, '2026-11-03-otsakkeen-jako');
  }
  for (let v = 0; v < NAMES.length; v++) {
    const dir = NAMES[v];
    for (const theme of ['light', 'dark']) {
      for (const sit of ['uusi', 'kaynnissa']) {
        const url = pathToFileURL(file).href + '?' + new URLSearchParams({ v: v + 1, w: width, theme, sit, bare: 1 });
        await page.goto(url);
        const frame = page.frameLocator('iframe');
        await frame.locator('.ah-agent-topline').waitFor();
        await page.waitForTimeout(150);
        const m = await frame.locator('body').evaluate((body, SEL) => {
          const hdr = body.querySelector('.ah-conversation-frame > .ah-agent-header');
          const top = hdr.querySelector('.ah-agent-topline');
          const hr = hdr.getBoundingClientRect();
          const kids = [...top.children].filter((el) => el.getClientRects().length && el.getBoundingClientRect().width > 2);
          const rows = new Set(kids.map((el) => Math.round(el.getBoundingClientRect().top / 8))).size;
          const off = kids.filter((el) => { const r = el.getBoundingClientRect(); return r.right > hr.right + 0.5 || r.left < hr.left - 0.5; }).map((el) => el.className);
          const oneOffs = kids.filter((el) => el.matches(':is(.ah-header-recap, .ah-retitle, .ah-archive-control, .ah-details-toggle), :has(> :is(.ah-header-recap, .ah-retitle))')).length;
          const models = [...body.querySelectorAll('.ah-set-model')].filter((el) => el.getClientRects().length).length;
          const inRow = Object.fromEntries(Object.entries(SEL).map(([k, s]) => {
            const el = top.querySelector(`:scope > ${s}`);
            return [k, el ? (el.getClientRects().length ? 'row' : 'hidden') : 'absent'];
          }));
          return { headerHeight: Math.round(hr.height), rows, off, oneOffs, models, inRow,
            titleWidth: Math.round(top.querySelector('h1')?.getBoundingClientRect().width ?? 0) };
        }, SEL);
        const tag = `${dir} ${width} ${theme} ${sit}`;
        metrics.push({ view: tag, ...m });
        assert.deepEqual(m.off, [], `${tag}: header item outside the header`);
        if (dir !== 'nyt') {
          assert.equal(m.rows, 1, `${tag}: header is ${m.rows} rows`);
          assert.equal(m.models, 1, `${tag}: the model shows ${m.models} times`);
          assert.equal(m.oneOffs, 0, `${tag}: a one-off action is in the row`);
          for (const [k, state] of Object.entries(m.inRow))
            if (state !== 'absent') assert.equal(state === 'row', ROW[dir].includes(k), `${tag}: ${k} is ${state}`);
        }
        const name = `${dir}-${width}-${FI[theme]}-${sit}`;
        await page.screenshot({ path: path.join(all, `${name}.png`) });
        const keep = (open) => dir !== 'nyt' && KEEP.some(([w, t, s, o]) => w === width && t === theme && s === sit && o === open);
        if (keep(false)) await page.screenshot({ path: path.join(kuvat, `${String(shot++).padStart(2, '0')}-${name}.png`) });
        // A desktop row today shows ⋯ only once it has had to shorten.
        const more = frame.locator('.ah-header-more');
        if (!(await more.isVisible())) {
          assert.ok(width > 800 && dir === 'nyt', `${tag}: no ⋯`);
          continue;
        }
        await more.click();
        await frame.locator('[role="menu"]').waitFor();
        if (dir !== 'nyt') {
          const menu = await frame.locator('[role="menu"]').evaluate((el) => ({
            heads: [...el.querySelectorAll('.p-menu-head')].map((h) => h.firstChild.textContent),
            ids: [...el.querySelectorAll('[data-menu-item]')].map((i) => i.dataset.menuItem),
          }));
          assert.equal(menu.heads[0], 'Keskustelu', `${tag}: ⋯ does not start with Keskustelu`);
          for (const [k, state] of Object.entries(m.inRow))
            if (state === 'hidden') assert.ok(menu.ids.includes(k), `${tag}: ${k} left the row but is not in ⋯`);
          assert.ok(!menu.ids.some((id) => ROW[dir].includes(id)), `${tag}: ⋯ repeats a row item`);
          metrics.at(-1).menu = menu;
        }
        if (keep(true)) await page.screenshot({ path: path.join(kuvat, `${String(shot++).padStart(2, '0')}-${name}-valikko.png`) });
        await frame.locator('body').press('Escape');
        assert.equal(await frame.locator('[role="menu"]').count(), 0, `${tag}: Esc leaves the menu open`);
      }
    }
  }
  await ctx.close();
}
await browser.close();
writeFileSync(path.join(all, 'metrics.json'), JSON.stringify(metrics, null, 1));
assert.deepEqual(errors, [], 'console errors');
assert.deepEqual(requests, [], 'network requests');
console.log(`${metrics.length} views checked, ${shot - 1} screenshots kept`);
for (const m of metrics.filter((x) => x.view.includes(' light ')))
  console.log(m.view.padEnd(36), 'h', m.headerHeight, 'rows', m.rows, 'title', m.titleWidth, m.menu ? m.menu.heads.join('/') + ': ' + m.menu.ids.join(',') : '');
