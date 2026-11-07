// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// every riff at 1440 and 390 light: the default (the agent of "Lokakuun
// ostolaskut" works in three browser windows, the strip is open, the pointer
// moves and clicks, "Rekrytointi: myyjä" waits for the browser); the chip with
// the strip folded; the waiting conversation and "Siirrä tälle"; a window's
// picture opening the sheet on that window with the pointer; taking control and
// handing back; Netvisor asking for the code mid-task, entering it in the sheet
// and handing back; finished while the other conversation drives, then free;
// and the browser's row in the rail (on the phone behind the menu). The
// defaults again at 1440 and 390 dark. Screenshots at device scale factor 2
// named r3-<riff>-<step>-<width>-<theme>.png; the console must stay clean.
import {createRequire} from 'node:module';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync, mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, '../../../../web/package.json'));
const {chromium} = require('playwright');
const round = '2026-11-07-palvelinselain-siru';
const [input, out] = process.argv.slice(2);
mkdirSync(out, {recursive: true});
const browser = await chromium.launch(process.env.PROTO_CHROMIUM ? {executablePath: process.env.PROTO_CHROMIUM} : {});
const names = ['1-vuorossa', '2-kentan-ylla', '3-otsikossa'];
let checks = 0;
const errors = [];
const ok = (v, m) => { assert.ok(v, m); checks++; };
const runs = [
  {width: 1440, theme: 'light', full: true},
  {width: 390, theme: 'light', full: true},
  {width: 1440, theme: 'dark', full: false},
  {width: 390, theme: 'dark', full: false},
];
try {
  for (const run of runs) {
    const {width, theme} = run, mobile = width === 390;
    const page = await browser.newPage({viewport: {width, height: mobile ? 844 : 900}, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile});
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.route('http://prototype.test/**', (r) => r.fulfill({contentType: 'text/html', body: readFileSync(input, 'utf8')}));
    await page.goto('http://prototype.test/');
    await page.locator('#theme').selectOption(theme);
    await checkPicker(page, round);
    const tag = `${width}-${theme}`;
    const fits = async () => ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'document overflow');
    const scrollEnd = () => page.evaluate(() => document.querySelectorAll('.ah-conversation-stream').forEach((el) => { el.scrollTop = el.scrollHeight; }));
    const capture = async (name) => { await scrollEnd(); await page.waitForTimeout(500); await page.screenshot({path: `${out}/r3-${name}-${tag}.png`}); };
    const id = (x) => page.locator(`[data-testid="${x}"]:visible`).first();
    const count = (x) => page.locator(`[data-testid="${x}"]:visible`).count();
    const state = () => page.evaluate(() => JSON.parse(JSON.stringify(window.rbStore)));
    const until = (fn, timeout = 15000) => page.waitForFunction(fn, null, {timeout});
    const closeSheet = async () => {
      if (await page.getByTestId('browser-sheet').count()) { await page.keyboard.press('Escape'); await page.getByTestId('browser-sheet').waitFor({state: 'detached'}); }
    };
    const scene = async (x) => { await closeSheet(); await id(x).click(); await page.waitForTimeout(150); };
    const view = (c) => page.locator('#conv').selectOption(c);
    for (const d of [0, 1, 2]) {
      await closeSheet();
      await page.locator('.proto-picker-item').nth(d).click();
      await page.locator(`.rb-review.variant-${d}`).waitFor({state: 'attached'});
      await view('osto');
      await scene('rb-reset');
      const n = names[d];
      assert.match(await id('direction-lines').locator('li[aria-current]').innerText(), new RegExp(`^${d + 1} `)); checks++;
      // Default: three windows in the open strip, the chip in this riff's place, the pointer moving.
      ok(await page.getByTestId('browser-sheet').count() === 0, 'sheet closed');
      await id('chip').waitFor(); checks++;
      ok((await id('chip').getAttribute('aria-expanded')) === 'true', 'strip open by default');
      ok(await count('win-pic') === 3, 'three windows');
      ok(await page.locator('[data-testid="win-pic"][data-active]:visible').count() === 1, 'one window has the agent');
      const where = await page.evaluate(() => {
        const t = [...document.querySelectorAll('[data-testid="chip"]')].find((e) => e.getClientRects().length);
        return t.closest('.ah-conversation-stream') ? 'stream' : t.closest('.rb-dock') ? 'dock' : t.closest('.ah-agent-header') ? 'header' : 'other';
      });
      ok(where === ['stream', 'dock', 'header'][d], `chip place ${where}`);
      ok(await count('agent-pointer') >= 1, 'the agent pointer is drawn');
      await scene('rb-reset');
      const seen = new Set();
      for (let i = 0; i < 8; i++) { seen.add(JSON.stringify((await state()).osto.ptr)); await page.waitForTimeout(200); }
      ok(seen.size > 1, 'the pointer moves');
      ok(await count('agent-click') >= 1, 'the last click is marked');
      ok(await count('rail-browser') === (mobile ? 0 : 1), 'browser row in the rail');
      if (!mobile) ok((await id('rail-browser').innerText()).includes('Lokakuun ostolaskut käyttää'), 'rail row names the driver');
      ok(await count('wait-line') >= 1, 'the waiting conversation is named');
      await fits();
      await scene('rb-reset');
      await page.waitForTimeout(1200);
      await capture(`${n}-0-oletus`);
      if (!run.full) continue;

      // The chip alone.
      await id('chip').click();
      ok(await count('strip') === 0, 'strip folds');
      await capture(`${n}-1-siru`);
      await id('chip').click();
      ok(await count('strip') === 1, 'strip opens');

      // The waiting conversation: who drives, and give it the browser.
      await view('rekry');
      await id('move-here').waitFor(); checks++;
      ok(await page.getByText('Lokakuun ostolaskut käyttää').count() >= 1, 'names the driving conversation');
      ok(await count('win-pic') === 3, 'sees the driving conversation\'s windows');
      await capture(`${n}-2-toinen`);
      await id('move-here').click();
      ok((await state()).holder === 'rekry', 'browser moved');
      await view('osto');
      await id('moved-line').waitFor(); checks++;

      // A window's picture opens the sheet on that window, view-only, with the pointer.
      await scene('rb-reset');
      await page.waitForTimeout(700);
      await page.locator('[data-testid="win-pic"][data-active]:visible').first().click();
      await page.getByTestId('browser-sheet').waitFor(); checks++;
      await id('view-only').waitFor(); checks++;
      ok(await page.getByTestId('browser-sheet').locator('[data-testid="sheet-tab"]').count() === 3, 'windows as tabs');
      ok(await page.getByTestId('browser-sheet').locator('[data-testid="agent-pointer"]').count() === 1, 'pointer in the sheet');
      await capture(`${n}-3-arkki`);
      await page.getByTestId('browser-sheet').locator('[data-testid="sheet-tab"]').nth(2).click();
      ok((await state()).sheetWin === 2, 'picks a window');
      await closeSheet();

      // Take control, then hand back.
      await id('take-control').click();
      ok((await state()).holder === 'person', 'person holds it');
      const stepAt = (await state()).osto.step;
      await page.waitForTimeout(2600);
      ok((await state()).osto.step === stepAt, 'the agent waits while the person holds the browser');
      ok(await count('agent-pointer') === 0, 'no agent pointer while the person drives');
      await id('hand-back').click();
      ok((await state()).holder === 'osto', 'handed back');

      // Netvisor asks for the code mid-task.
      await scene('rb-asking');
      await id('enter-code').waitFor(); checks++;
      await fits();
      await capture(`${n}-4-pyytaa`);
      await id('enter-code').click();
      await id('site-code').fill('482913');
      await id('site-verify').click();
      await until(() => window.rbStore.osto.wins[0].page === 'list'); checks++;
      await page.getByTestId('browser-sheet').locator('[data-testid="hand-back"]').click();
      await page.getByTestId('browser-sheet').waitFor({state: 'detached'}); checks++;
      ok((await state()).holder === 'osto', 'agent continues');

      // Finished while the other conversation drives; then the browser is free.
      await scene('rb-done');
      ok((await state()).osto.state === 'done', 'done');
      await page.waitForTimeout(900);
      await capture(`${n}-5-valmis`);
      await until(() => window.rbStore.holder === null, 20000); checks++;
      await page.waitForTimeout(300);
      ok((await id('chip').getAttribute('data-state')) === (d === 0 ? 'done' : 'null'), 'chip after the work');
      await capture(`${n}-6-vapaa`);
      await fits();

      // The browser's row in the rail opens the sheet.
      await scene('rb-reset');
      if (mobile) { await id('navigation-open').click(); await id('rail-browser').waitFor(); checks++; await page.waitForTimeout(400); }
      await capture(`${n}-7-rivi`);
      await id('rail-browser').click();
      await page.getByTestId('browser-sheet').waitFor(); checks++;
      await closeSheet();
    }
    await page.close();
  }
  assert.deepEqual(errors, [], 'console errors');
  console.log(`${checks} checks, console clean`);
} finally {
  await browser.close();
}
