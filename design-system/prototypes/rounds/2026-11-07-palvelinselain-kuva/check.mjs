// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// every riff at 1440 and 390 light: the default (the agent of "Lokakuun
// ostolaskut" works, the sheet is closed, "Rekrytointi: myyjä" waits for the
// browser); the waiting conversation's view; giving the browser to it and how
// the first conversation then reads; the picture opening the sheet; taking
// control and handing back; Netvisor asking for the code mid-task, entering
// it in the sheet and handing back; the finished task while the other
// conversation drives; and the free browser after both have finished. The
// defaults again at 1440 and 390 dark. Screenshots at device scale factor 2
// named r2-<riff>-<step>-<width>-<theme>.png; the console must stay clean.
import {createRequire} from 'node:module';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync, mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, '../../../../web/package.json'));
const {chromium} = require('playwright');
const round = '2026-11-07-palvelinselain-kuva';
const [input, out] = process.argv.slice(2);
mkdirSync(out, {recursive: true});
const browser = await chromium.launch(process.env.PROTO_CHROMIUM ? {executablePath: process.env.PROTO_CHROMIUM} : {});
const names = ['1-kuva', '2-palkki', '3-kelluva'];
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
    const capture = async (name) => { await scrollEnd(); await page.waitForTimeout(400); await page.screenshot({path: `${out}/r2-${name}-${tag}.png`}); };
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
      // Default: the agent works, the sheet is closed, the picture is this riff's.
      ok(await page.getByTestId('browser-sheet').count() === 0, 'sheet closed');
      await id('thumb').waitFor(); checks++;
      ok(await page.locator('[data-testid="thumb"]:visible .rb-pic').count() === 1, 'one picture');
      const where = await page.evaluate(() => {
        const t = [...document.querySelectorAll('[data-testid="thumb"]')].find((e) => e.offsetParent || e.getClientRects().length);
        return t.closest('.ah-conversation-stream') ? 'stream' : t.closest('.ah-floating-controls') ? 'float' : 'frame';
      });
      ok(where === ['stream', 'frame', 'float'][d], `picture place ${where}`);
      ok(await count('take-control') >= 1, 'take control offered');
      ok(await id('wait-line').count() + await page.getByText('Rekrytointi: myyjä odottaa vuoroaan').count() >= 1, 'the waiting conversation is named');
      await fits();
      await capture(`${n}-0-oletus`);
      if (!run.full) continue;

      // The waiting conversation: who drives, and give it the browser.
      await view('rekry');
      await id('move-here').waitFor(); checks++;
      ok(await page.getByText('Lokakuun ostolaskut käyttää').count() >= 1, 'names the driving conversation');
      await capture(`${n}-1-toinen`);
      await id('move-here').click();
      ok((await state()).holder === 'rekry', 'browser moved');
      await view('osto');
      await id('moved-line').waitFor(); checks++;
      await capture(`${n}-2-siirretty`);

      // The picture opens the sheet.
      await scene('rb-reset');
      await id('picture').click();
      await page.getByTestId('browser-sheet').waitFor(); checks++;
      await id('view-only').waitFor(); checks++;
      await closeSheet();

      // Take control, then hand back.
      await id('take-control').click();
      ok((await state()).holder === 'person', 'person holds it');
      const stepAt = (await state()).osto.step;
      await page.waitForTimeout(2400);
      ok((await state()).osto.step === stepAt, 'the agent waits while the person holds the browser');
      await capture(`${n}-3-otit`);
      await id('hand-back').click();
      ok((await state()).holder === 'osto', 'handed back');

      // Netvisor asks for the code mid-task: the picture is the request.
      await scene('rb-asking');
      await id('enter-code').waitFor(); checks++;
      await fits();
      await capture(`${n}-4-pyytaa`);
      await id('enter-code').click();
      await id('site-code').fill('482913');
      await id('site-verify').click();
      await until(() => window.rbStore.page === 'list'); checks++;
      await capture(`${n}-5-koodi`);
      await page.getByTestId('browser-sheet').locator('[data-testid="hand-back"]').click();
      await page.getByTestId('browser-sheet').waitFor({state: 'detached'}); checks++;
      ok((await state()).holder === 'osto', 'agent continues');

      // Finished while the other conversation drives; then the browser is free.
      await scene('rb-done');
      ok((await state()).osto.state === 'done', 'done');
      await capture(`${n}-6-valmis`);
      await until(() => window.rbStore.holder === null, 20000); checks++;
      await page.waitForTimeout(200);
      if (d === 1) ok(await count('thumb') === 0 && await count('done-line') === 1, 'strip leaves a line');
      if (d === 2) ok((await id('thumb').getAttribute('data-state')) === 'free', 'window folds into a button');
      if (d === 0) ok((await id('thumb').getAttribute('data-state')) === 'done', 'picture freezes');
      await capture(`${n}-7-vapaa`);
      await fits();
    }
    await page.close();
  }
  assert.deepEqual(errors, [], 'console errors');
  console.log(`${checks} checks, console clean`);
} finally {
  await browser.close();
}
