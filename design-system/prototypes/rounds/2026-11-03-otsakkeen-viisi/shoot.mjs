// Builds the round and checks it offline: every direction and today, at 390, 360
// and 1440 px, light and dark, in a new and a running conversation. In each
// direction the phone's header is one row with every item inside it; the row
// carries all five of the desktop's facts (workspace, activity, Git, context
// once there is any, model); no panel or one-off action is in the phone's row;
// ⋯ lists only actions; and the facts open their full values. No console
// errors, no network, picker-check passes. Writes metrics.json and every view
// to ../../dist/otsakkeen-viisi-check/, and the chosen DSF-2 screenshots to the
// issue's prototype-3/kuvat/ (PNG; scripts/screenshots-to-avif.py converts them).
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-11-03-otsakkeen-viisi/shoot.mjs
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
const issue = path.join(root, 'issues/phone-header-second-row-uneven/prototype-3');
const file = path.join(issue, 'otsakkeen-viisi.html');
const all = path.join(root, 'design-system/prototypes/dist/otsakkeen-viisi-check');
const kuvat = path.join(issue, 'kuvat');
execFileSync('node', [path.join(here, 'build.mjs'), '--out', file], { stdio: 'inherit' });
mkdirSync(all, { recursive: true });
mkdirSync(kuvat, { recursive: true });

const NAMES = ['1-alarivi', '2-yksi-siru', '3-omat-merkit', 'nyt'];
const FI = { light: 'vaalea', dark: 'tumma' };
// Screenshots Jari gets, per direction: [width, theme, situation, what is open].
const KEEP = [
  [390, 'light', 'uusi', ''], [390, 'light', 'kaynnissa', ''], [390, 'dark', 'kaynnissa', 'tiedot'],
  [360, 'light', 'kaynnissa', ''], [1440, 'light', 'kaynnissa', ''], [1440, 'dark', 'uusi', ''],
];
// Where a tap shows a fact's full value.
const TAP = { '1-alarivi': '.p-sub', '2-yksi-siru': '.p-chip', '3-omat-merkit': '.ah-gs-chip' };


// The inventory: today's desktop row with its five facts named.
async function inventory(page) {
  const url = pathToFileURL(file).href + '?' + new URLSearchParams({ v: 4, w: 1440, theme: 'light', sit: 'kaynnissa', bare: 1 });
  await page.goto(url);
  const frame = page.frameLocator('iframe');
  await frame.locator('.ah-agent-topline').waitFor();
  const found = await frame.locator('body').evaluate((body) => {
    const FIVE = [
      ['.ah-header-workspace', '1 Työtila (repo)'],
      ['.ah-header-activity', '2 Tila'],
      ['.ah-gs-chip', '3 Git'],
      ['.ah-ctx-chip', '4 Konteksti'],
      [':is(.md-chip-picker > summary, .ah-set-chip)', '5 Malli'],
    ];
    const layer = document.createElement('div');
    layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:99999;font:600 13px/1 var(--ah-font)';
    let n = 0;
    for (const [sel, label] of FIVE) {
      const el = body.querySelector(`.ah-agent-topline ${sel}`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      layer.insertAdjacentHTML('beforeend',
        `<div style="position:absolute;left:${r.left - 3}px;top:${r.top - 3}px;width:${r.width + 6}px;height:${r.height + 6}px;border:2px solid #d4380d;border-radius:8px"></div>`
        + `<div style="position:absolute;left:${r.left + r.width / 2}px;top:${r.bottom + (n % 2 ? 10 : 42)}px;transform:translateX(-50%);white-space:nowrap;padding:5px 8px;border-radius:6px;background:#d4380d;color:#fff">${label}</div>`);
      n++;
    }
    body.append(layer);
    return n;
  });
  assert.equal(found, 5, 'the inventory finds the five facts in today\'s desktop row');
  await page.screenshot({ path: path.join(kuvat, '00-inventaario-1440.png'), clip: { x: 0, y: 0, width: 1440, height: 160 } });
}

const browser = await chromium.launch();
const errors = [], requests = [], metrics = [];
let shot = 1;
for (const width of [390, 360, 1440]) {
  const ctx = await browser.newContext({ viewport: { width, height: width > 800 ? 900 : 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', (r) => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
  if (width === 1440) await inventory(page);
  if (width === 390) {
    await page.goto(pathToFileURL(file).href);
    await checkPicker(page, '2026-11-03-otsakkeen-viisi');
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
        const m = await frame.locator('body').evaluate((body) => {
          const hdr = body.querySelector('.ah-conversation-frame > .ah-agent-header');
          const top = hdr.querySelector('.ah-agent-topline');
          const hr = hdr.getBoundingClientRect();
          const seen = (el) => el.getClientRects().length > 0 && el.getBoundingClientRect().width > 2
            && getComputedStyle(el).visibility !== 'hidden';
          const kids = [...top.children].filter(seen);
          const rows = new Set(kids.map((el) => Math.round(el.getBoundingClientRect().top / 8))).size;
          const off = kids.filter((el) => { const r = el.getBoundingClientRect(); return r.right > hr.right + 0.5 || r.left < hr.left - 0.5; }).map((el) => el.className);
          // Text inside display: contents has no box of its own; ask the text.
          const walk = document.createTreeWalker(top, NodeFilter.SHOW_TEXT);
          const texts = [];
          for (let n; (n = walk.nextNode());) {
            const r = document.createRange();
            r.selectNodeContents(n);
            if (n.textContent.trim() && [...r.getClientRects()].some((x) => x.width > 1)) texts.push(n.textContent.trim());
          }
          const visibleText = texts.join(' ');
          const five = {
            workspace: /aurinkokello|\bAU\b/.test(visibleText),
            activity: [...top.querySelectorAll('.ah-status-dot')].some(seen),
            git: [...top.querySelectorAll('.ah-gs-n')].some(seen),
            context: [...top.querySelectorAll('.ah-ctx-ring')].some(seen),
            model: /Opus/.test(visibleText),
          };
          const busy = kids.filter((el) => el.matches(':is(.ah-header-recap, .ah-retitle, .ah-archive-control, .ah-details-toggle, .ah-editor-controls, .ah-terminal-toggle), :has(> :is(.ah-header-recap, .ah-retitle))')).length;
          return { headerHeight: Math.round(hr.height), rows, off, five, busy,
            hasContext: !!top.querySelector('.ah-ctx-chip'),
            titleWidth: Math.round(top.querySelector('h1')?.getBoundingClientRect().width ?? 0) };
        });
        const tag = `${dir} ${width} ${theme} ${sit}`;
        metrics.push({ view: tag, ...m });
        assert.deepEqual(m.off, [], `${tag}: header item outside the header`);
        if (dir !== 'nyt') {
          for (const [fact, shown] of Object.entries(m.five))
            if (fact !== 'context' || m.hasContext) assert.ok(shown, `${tag}: ${fact} is not in the row`);
          if (width <= 800) {
            assert.equal(m.rows, 1, `${tag}: header is ${m.rows} rows`);
            assert.equal(m.busy, 0, `${tag}: a panel or a one-off action is in the phone's row`);
          }
        }
        const name = `${dir}-${width}-${FI[theme]}-${sit}`;
        await page.screenshot({ path: path.join(all, `${name}.png`) });
        const keep = (open) => dir !== 'nyt' && KEEP.some(([w, t, s, o]) => w === width && t === theme && s === sit && o === open);
        if (keep('')) await page.screenshot({ path: path.join(kuvat, `${String(shot++).padStart(2, '0')}-${name}.png`) });
        if (dir === 'nyt') continue;

        // A tap on the facts shows their full values; Esc closes.
        const tap = frame.locator(TAP[dir]).first();
        if (await tap.isVisible()) {
          await tap.click();
          const items = await frame.locator('[role="menu"] [data-menu-item]').evaluateAll((els) => els.map((e) => e.dataset.menuItem));
          const want = dir === '3-omat-merkit' ? ['git'] : ['status', 'workspace', 'git', ...(m.hasContext ? ['context'] : []), 'model'];
          assert.deepEqual(items, want, `${tag}: the tap shows ${items}`);
          if (keep('tiedot')) await page.screenshot({ path: path.join(kuvat, `${String(shot++).padStart(2, '0')}-${name}-tiedot.png`) });
          await frame.locator('body').press('Escape');
          assert.equal(await frame.locator('[role="menu"]').count(), 0, `${tag}: Esc leaves the values open`);
        }
        // ⋯ lists only actions.
        const more = frame.locator('.ah-header-more');
        if (await more.isVisible()) {
          await more.click();
          const ids = await frame.locator('[role="menu"] [data-menu-item]').evaluateAll((els) => els.map((e) => e.dataset.menuItem));
          const facts = ids.filter((id) => ['status', 'git', 'context', 'model'].includes(id));
          assert.deepEqual(facts, [], `${tag}: ⋯ shows a fact`);
          if (width <= 800) assert.ok(ids.includes('editor') && ids.includes('terminal'), `${tag}: the panels are not in ⋯`);
          metrics.at(-1).menu = ids;
          if (dir === '2-yksi-siru' && width === 390 && theme === 'light' && sit === 'kaynnissa')
            await page.screenshot({ path: path.join(kuvat, `${String(shot++).padStart(2, '0')}-${name}-valikko.png`) });
          await frame.locator('body').press('Escape');
        } else assert.ok(width > 800, `${tag}: no ⋯ on a phone`);
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
  console.log(m.view.padEnd(36), 'h', m.headerHeight, 'rows', m.rows, 'title', m.titleWidth, m.menu ? m.menu.join(',') : '');
