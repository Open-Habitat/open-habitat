// Builds the round and checks it offline: every direction and today, at 390, 360
// and 1440 px, light and dark, in a new and a running conversation. In each view
// the header's items stay inside the header, the directions' state items share one
// height, the composer chip is the only model in a new conversation (and in 3
// always), and ⋯ opens its menu (in 3 with the Tila section). No console errors,
// no network, picker-check passes. Writes metrics.json and every view to
// ../../dist/otsakkeen-toinen-rivi-check/, and the chosen DSF-2 screenshots to the
// issue's kuvat/ (PNG; screenshots-to-avif.py converts them).
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-11-02-otsakkeen-toinen-rivi/shoot.mjs
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
const issue = path.join(root, 'issues/phone-header-second-row-uneven/prototype');
const file = path.join(issue, 'otsakkeen-toinen-rivi.html');
const all = path.join(root, 'design-system/prototypes/dist/otsakkeen-toinen-rivi-check');
const kuvat = path.join(issue, 'kuvat');
execFileSync('node', [path.join(here, 'build.mjs'), '--out', file], { stdio: 'inherit' });
mkdirSync(all, { recursive: true });
mkdirSync(kuvat, { recursive: true });

const NAMES = ['1-ikonirytmi', '2-sirut', '3-yksi-rivi', 'nyt'];
const FI = { light: 'vaalea', dark: 'tumma', uusi: 'uusi', kaynnissa: 'kaynnissa' };
// Screenshots Jari gets, per direction: [width, theme, situation, menu open].
const KEEP = [
  [390, 'light', 'uusi', false], [390, 'dark', 'uusi', false], [360, 'light', 'kaynnissa', false],
  [1440, 'light', 'uusi', false], [1440, 'dark', 'kaynnissa', false],
];
const KEEP3 = [[390, 'light', 'kaynnissa', true], [1440, 'light', 'kaynnissa', true]];

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
    await checkPicker(page, '2026-11-02-otsakkeen-toinen-rivi');
  }
  for (let v = 0; v < NAMES.length; v++) {
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
          const kids = [...top.children].filter((el) => el.getClientRects().length && el.getBoundingClientRect().width > 2);
          const title = top.querySelector('.ah-title-row').getBoundingClientRect();
          const rows = new Set(kids.map((el) => Math.round(el.getBoundingClientRect().top / 8))).size;
          const second = kids.filter((el) => el.getBoundingClientRect().top > title.bottom - 2)
            .map((el) => ({ cls: el.className.split(' ').filter((c) => c.startsWith('ah-') || c.startsWith('md-')).join('.') || el.className, h: Math.round(el.getBoundingClientRect().height) }));
          const state = kids.filter((el) => el.matches('.ah-header-activity, .ah-gs-chip, .ah-ctx-chip, .md-chip-picker, .ah-set-chip'))
            .map((el) => Math.round((el.matches('.md-chip-picker') ? el.querySelector('summary') : el).getBoundingClientRect().height));
          const off = kids.filter((el) => { const r = el.getBoundingClientRect(); return r.right > hr.right + 0.5 || r.left < hr.left - 0.5; }).map((el) => el.className);
          const models = [...body.querySelectorAll('.ah-set-model')].filter((el) => el.getClientRects().length).length;
          return { headerHeight: Math.round(hr.height), rows, second, state, off, models,
            titleWidth: Math.round(top.querySelector('h1')?.getBoundingClientRect().width ?? 0) };
        });
        const tag = `${NAMES[v]} ${width} ${theme} ${sit}`;
        metrics.push({ view: tag, ...m });
        assert.deepEqual(m.off, [], `${tag}: header item outside the header`);
        if (NAMES[v] !== 'nyt') {
          assert.equal(m.models, 1, `${tag}: the model shows ${m.models} times`);
          if (m.state.length) assert.equal(new Set(m.state).size, 1, `${tag}: state items differ in height ${m.state}`);
          if (width <= 800) assert.ok(m.second.every((s) => !/_disabledTrigger/.test(s.cls)), `${tag}: a disabled action is on the second row`);
          if (NAMES[v] === '3-yksi-rivi' && width <= 800) assert.equal(m.rows, 1, `${tag}: more than one header row`);
          else if (width <= 800) assert.ok(m.rows <= 2, `${tag}: header wraps to ${m.rows} rows`);
        }
        const name = `${NAMES[v]}-${width}-${FI[theme]}-${sit}`;
        await page.screenshot({ path: path.join(all, `${name}.png`) });
        const keep = KEEP.some(([w, t, s]) => w === width && t === theme && s === sit);
        if (keep && NAMES[v] !== 'nyt') await page.screenshot({ path: path.join(kuvat, `${String(shot++).padStart(2, '0')}-${name}.png`) });
        // ⋯ opens; in 3 its Tila section lists what left the row.
        // A desktop row shows ⋯ only once it has had to shorten (production);
        // a phone and direction 3 always have it.
        const more = frame.locator('.ah-header-more');
        if (!(await more.isVisible())) {
          assert.ok(width > 800 && NAMES[v] !== '3-yksi-rivi', `${tag}: no ⋯`);
          continue;
        }
        await more.click();
        await frame.locator('[role="menu"]').waitFor();
        if (NAMES[v] === '3-yksi-rivi') assert.ok(await frame.locator('.p-menu-state-row').count() >= 1, `${tag}: no Tila section in ⋯`);
        const keepMenu = NAMES[v] === '3-yksi-rivi' && KEEP3.some(([w, t, s]) => w === width && t === theme && s === sit);
        if (keepMenu) await page.screenshot({ path: path.join(kuvat, `${String(shot++).padStart(2, '0')}-${name}-valikko.png`) });
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
for (const m of metrics.filter((x) => x.view.includes(' light '))) console.log(m.view.padEnd(34), 'h', m.headerHeight, 'rows', m.rows, 'state', m.state.join('/'), 'title', m.titleWidth);
