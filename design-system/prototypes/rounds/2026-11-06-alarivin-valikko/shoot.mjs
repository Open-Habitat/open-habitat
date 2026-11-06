// Builds the round and checks it offline: every riff and today, at 390 and 1440
// px, light and dark, in a new and a running conversation. On a phone each riff
// shows the chosen bottom row (one line under the title, status as a dot) and
// starts with what its tap opens; the open thing closes the riff's own ways
// (A: Esc and a tap outside; B: ✕, the scrim, Esc; C: Esc, and the context
// page's back button), and its rows lead to the facts' own places. The desktop
// stays today's production row in every riff. ⋯ lists no fact. No console
// errors, no network, picker-check passes. Writes metrics.json and every view
// to ../../dist/alarivin-valikko-check/, and the chosen DSF-2 screenshots to the
// issue's evidence/ with the prefix r4- (PNG; scripts/screenshots-to-avif.py
// converts them).
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-11-06-alarivin-valikko/shoot.mjs
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
const issue = path.join(root, 'issues/phone-header-second-row-uneven');
const file = path.join(issue, 'prototype-4/alarivin-valikko.html');
const all = path.join(root, 'design-system/prototypes/dist/alarivin-valikko-check');
const evidence = path.join(issue, 'evidence');
execFileSync('node', [path.join(here, 'build.mjs'), '--out', file], { stdio: 'inherit' });
mkdirSync(all, { recursive: true });
mkdirSync(evidence, { recursive: true });

const NAMES = ['a-valikko', 'b-alalaatikko', 'c-omat-napit', 'nyt'];
const FI = { light: 'vaalea', dark: 'tumma' };
let shot = 1;
const keep = async (page, name) => page.screenshot({ path: path.join(evidence, `r4-${String(shot++).padStart(2, '0')}-${name}.png`) });

const browser = await chromium.launch();
const errors = [], requests = [], metrics = [];
const open = (frame) => frame.locator('body').evaluate(() => ({
  menu: !!document.querySelector('.p-menu'),
  sheet: !!document.querySelector('.p-sheet'),
  model: !!document.querySelector('.p-modelcard'),
  context: !!document.querySelector('.ah-cd-page'),
}));
const none = { menu: false, sheet: false, model: false, context: false };

for (const width of [390, 1440]) {
  const ctx = await browser.newContext({ viewport: { width, height: width > 800 ? 900 : 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', (r) => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
  if (width === 390) {
    await page.goto(pathToFileURL(file).href);
    await checkPicker(page, '2026-11-06-alarivin-valikko');
  }
  for (let v = 0; v < NAMES.length; v++) {
    const dir = NAMES[v];
    for (const theme of ['light', 'dark']) {
      for (const sit of ['kaynnissa', 'uusi']) {
        const go = async (start) => {
          await page.goto(pathToFileURL(file).href + '?' + new URLSearchParams({ v: v + 1, w: width, theme, sit, start, bare: 1 }));
          const frame = page.frameLocator('iframe');
          await frame.locator('.ah-agent-topline').waitFor();
          await page.waitForTimeout(150);
          return frame;
        };
        const tag = `${dir} ${width} ${theme} ${sit}`;
        const name = `${dir}-${width}-${FI[theme]}-${sit}`;
        let frame = await go('open');
        const m = await frame.locator('body').evaluate((body) => {
          const hdr = body.querySelector('.ah-conversation-frame > .ah-agent-header');
          const top = hdr.querySelector('.ah-agent-topline');
          const line = top.querySelector('.p-sub');
          const h1 = top.querySelector('h1');
          return {
            headerHeight: Math.round(hdr.getBoundingClientRect().height),
            line: !!line,
            lineBelowTitle: line ? line.getBoundingClientRect().top >= h1.getBoundingClientRect().bottom - 1 : null,
            titleWidth: Math.round(h1?.getBoundingClientRect().width ?? 0),
            statusWord: [...top.querySelectorAll('.ah-status')].some((s) => s.getBoundingClientRect().width > 20 && getComputedStyle(s).fontSize !== '0px'),
          };
        });
        const state = await open(frame);
        metrics.push({ view: tag, ...m, open: state });
        await page.screenshot({ path: path.join(all, `${name}.png`) });
        const phone = width <= 800;
        if (dir === 'nyt' || !phone) {
          assert.equal(m.line, false, `${tag}: the desktop or today has the bottom row`);
          assert.deepEqual(state, none, `${tag}: something starts open`);
          if (dir === 'a-valikko' && (theme === 'light') === (sit === 'kaynnissa') && !phone) await keep(page, `tyopoyta-1440-${FI[theme]}-${sit}`);
          continue;
        }
        assert.ok(m.line && m.lineBelowTitle, `${tag}: no bottom row under the title`);
        assert.equal(m.statusWord, false, `${tag}: the status shows as a word in the row`);
        if (sit === 'kaynnissa' || theme === 'light') await keep(page, `${name}`);

        if (dir === 'a-valikko') {
          assert.ok(state.menu, `${tag}: the menu is not open`);
          const items = await frame.locator('.p-menu [data-menu-item]').evaluateAll((els) => els.map((e) => e.dataset.menuItem));
          assert.deepEqual(items, ['workspace', 'git', ...(sit === 'kaynnissa' ? ['context'] : []), 'model'], `${tag}: menu rows ${items}`);
          assert.ok(await frame.locator('.p-menu .p-state').isVisible(), `${tag}: no status heading`);
          await frame.locator('body').press('Escape');
          assert.deepEqual(await open(frame), none, `${tag}: Esc leaves the menu`);
          await frame.locator('.p-sub').click();
          await frame.locator('.ah-conversation-stream').click({ position: { x: 20, y: 300 }, force: true });
          assert.deepEqual(await open(frame), none, `${tag}: a tap outside leaves the menu`);
          await frame.locator('.p-sub').click();
          await frame.locator('.p-menu [data-menu-item="git"]').click();
          assert.ok((await open(frame)).sheet, `${tag}: Git row opens no Git sheet`);
          if (theme === 'light' && sit === 'kaynnissa') await keep(page, `${name}-git`);
          await frame.locator('.p-sheet [slot="close"]').click();
          if (sit === 'kaynnissa') {
            await frame.locator('.p-sub').click();
            await frame.locator('.p-menu [data-menu-item="context"]').click();
            assert.ok((await open(frame)).context, `${tag}: context row opens no context page`);
            await frame.locator('.ah-cd-back').click();
            assert.deepEqual(await open(frame), none, `${tag}: back leaves the context page`);
          }
        }
        if (dir === 'b-alalaatikko') {
          assert.ok(state.sheet, `${tag}: the sheet is not open`);
          const rows = await frame.locator('.p-sheet .p-sheet-row').evaluateAll((els) => els.map((e) => e.dataset.testid));
          assert.deepEqual(rows, ['p-row-workspace', ...(sit === 'kaynnissa' ? ['p-row-context'] : []), 'p-row-model'], `${tag}: sheet rows ${rows}`);
          assert.ok(await frame.locator('.p-sheet .ah-gs-sec[aria-label="Seurantahaara"]').count(), `${tag}: no Git details in the sheet`);
          await frame.locator('.p-sheet [slot="close"]').click();
          assert.deepEqual(await open(frame), none, `${tag}: ✕ leaves the sheet`);
          await frame.locator('.p-sub').click();
          await frame.locator('.p-sheet').click({ position: { x: 20, y: 40 } });
          assert.deepEqual(await open(frame), none, `${tag}: the scrim leaves the sheet`);
          await frame.locator('.p-sub').click();
          await frame.locator('.p-sheet [data-testid="p-row-model"]').click();
          assert.ok((await open(frame)).model, `${tag}: model row opens no model card`);
          if (theme === 'light' && sit === 'kaynnissa') await keep(page, `${name}-malli`);
          await frame.locator('body').press('Escape');
          assert.deepEqual(await open(frame), none, `${tag}: Esc leaves the model card`);
        }
        if (dir === 'c-omat-napit') {
          assert.ok(state.sheet, `${tag}: the Git sheet is not open`);
          const segs = await frame.locator('.p-seg').evaluateAll((els) => els.map((e) => e.dataset.seg));
          assert.deepEqual(segs, ['workspace', 'git', ...(sit === 'kaynnissa' ? ['context'] : []), 'model'], `${tag}: segments ${segs}`);
          await frame.locator('body').press('Escape');
          await frame.locator('[data-seg="model"]').click();
          assert.ok((await open(frame)).model, `${tag}: the model opens no card`);
          if (theme === 'light' && sit === 'kaynnissa') await keep(page, `${name}-malli`);
          await frame.locator('[data-seg="model"]').click();
          assert.deepEqual(await open(frame), none, `${tag}: the model again leaves the card`);
          if (sit === 'kaynnissa') {
            await frame.locator('[data-seg="context"]').click();
            assert.ok((await open(frame)).context, `${tag}: the ring opens no context page`);
            if (theme === 'light') await keep(page, `${name}-konteksti`);
            await frame.locator('.ah-cd-back').click();
          }
          await frame.locator('[data-seg="workspace"]').click();
          assert.ok((await open(frame)).menu, `${tag}: the workspace opens nothing`);
          await frame.locator('body').press('Escape');
        }
        // ⋯ lists no fact.
        frame = await go('closed');
        await frame.locator('.ah-header-more').click();
        const ids = await frame.locator('.p-menu [data-menu-item]').evaluateAll((els) => els.map((e) => e.dataset.menuItem));
        assert.deepEqual(ids.filter((id) => ['status', 'git', 'context', 'model'].includes(id)), [], `${tag}: ⋯ shows a fact`);
        assert.ok(ids.includes('terminal'), `${tag}: the terminal is not in ⋯`);
        metrics.at(-1).more = ids;
        await frame.locator('body').press('Escape');
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
  console.log(m.view.padEnd(36), 'h', m.headerHeight, 'title', m.titleWidth, m.more ? m.more.join(',') : '');
