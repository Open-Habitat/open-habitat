// node check.mjs <offline.html> <evidence-dir> [riff numbers, e.g. 1,3]
// Authored synthetic component lab, not a host-backed acceptance test. For
// every riff at 1440 and 390 light: the default (Netvisor's window asks for a
// code while the agent has three windows; the request belongs to that window
// alone); watching the agent's window in the sheet (the agent keeps working);
// taking control and handing back; the request's own action, entering the code
// in control, handing back from the strip and the agent carrying on; riff 2's
// larger picture in the strip; the browser's row in the rail (on the phone
// behind the menu); and finished then free. The defaults again at 1440 and 390
// dark. Screenshots at device scale factor 2 named
// r4-<riff>-<step>-<width>-<theme>.png; the console must stay clean.
import {createRequire} from 'node:module';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync, mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, '../../../../web/package.json'));
const {chromium} = require('playwright');
const round = '2026-11-07-palvelinselain-pyynto';
const [input, out, only] = process.argv.slice(2);
const riffs = only ? only.split(',').map((x) => Number(x) - 1) : [0, 1, 2];
mkdirSync(out, {recursive: true});
const browser = await chromium.launch(process.env.PROTO_CHROMIUM ? {executablePath: process.env.PROTO_CHROMIUM} : {});
const names = ['1-ikkunan-alla', '2-ikkuna-esiin', '3-ohjaus-ikkunalle'];
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
    const capture = async (name) => { await scrollEnd(); await page.waitForTimeout(500); await page.screenshot({path: `${out}/r4-${name}-${tag}.png`}); };
    const id = (x) => page.locator(`[data-testid="${x}"]:visible`).first();
    const count = (x) => page.locator(`[data-testid="${x}"]:visible`).count();
    const sheet = () => page.getByTestId('browser-sheet');
    const inSheet = (x) => sheet().locator(`[data-testid="${x}"]`).first();
    const state = () => page.evaluate(() => JSON.parse(JSON.stringify(window.rbStore)));
    const until = (fn, timeout = 15000) => page.waitForFunction(fn, null, {timeout});
    const closeSheet = async () => {
      if (await sheet().count()) { await page.keyboard.press('Escape'); await sheet().waitFor({state: 'detached'}); }
    };
    const scene = async (x) => { await closeSheet(); await id(x).click(); await page.waitForTimeout(150); };
    const view = (c) => page.locator('#conv').selectOption(c);
    for (const d of riffs) {
      await closeSheet();
      await page.locator('.proto-picker-item').nth(d).click();
      await page.locator(`.rb-review.variant-${d}`).waitFor({state: 'attached'});
      await view('osto');
      await scene('rb-asking');
      const n = names[d];
      assert.match(await id('direction-lines').locator('li[aria-current]').innerText(), new RegExp(`^${d + 1} `)); checks++;

      // Default: Netvisor's window asks; the request is that window's alone.
      ok(await sheet().count() === 0, 'sheet closed');
      ok((await id('chip').getAttribute('aria-expanded')) === 'true', 'strip open by default');
      ok(await page.evaluate(() => [...document.querySelectorAll('[data-testid="chip"]')].some((t) => t.getClientRects().length && t.closest('.rb-dock'))), 'chip above the composer');
      ok(await count('win-pic') === 3, 'three windows');
      ok(await count('win-ask') === 1, 'one request');
      ok(await page.evaluate(() => {
        const r = [...document.querySelectorAll('[data-testid="win-ask"]')].find((e) => e.getClientRects().length);
        return r.closest('[data-win="0"]') !== null;
      }), 'the request belongs to the Netvisor window');
      ok(!(await id('now-line').innerText()).includes('vahvistuskoodia'), 'the strip\'s sentence does not repeat the request');
      ok((await id('chip').innerText()).includes('Netvisor odottaa sinua'), 'the chip names the window');
      ok((await state()).person === null, 'nobody took control by asking');
      if (!mobile) ok((await id('rail-browser').innerText()).includes('Odottaa sinua'), 'rail row says the browser waits');
      const s0 = await state();
      await page.waitForTimeout(3300);
      const s1 = await state();
      if (d === 2) ok(JSON.stringify(s0.osto.ptr) !== JSON.stringify(s1.osto.ptr) && s1.osto.ptr.win !== 0, 'riff 3: the agent works on in the other windows');
      else ok(JSON.stringify(s0.osto.ptr) === JSON.stringify(s1.osto.ptr), 'the agent waits');
      ok(await count('agent-pointer') >= 1, 'the agent pointer is drawn');
      await fits();
      await capture(`${n}-0-oletus`);
      if (!run.full) continue;

      // Watching: a window's picture opens the sheet; the agent keeps control and goes on.
      await scene('rb-working');
      await page.waitForTimeout(700);
      if (d === 1) await page.locator('.rb-strip-lead [data-testid="win-pic"]:visible').click();
      else await page.locator('[data-testid="win-pic"][data-active]:visible').first().click();
      await sheet().waitFor(); checks++;
      ok((await sheet().getAttribute('data-mode')) === 'watch', 'the sheet opens watching');
      await id('view-only').waitFor(); checks++;
      ok((await inSheet('sheet-line').innerText()).startsWith('Katselet'), 'says watching');
      ok(await sheet().locator('[data-testid="agent-pointer"]').count() === 1, 'the agent pointer in the sheet');
      const before = (await state()).osto.step;
      await page.waitForTimeout(2700);
      ok((await state()).osto.step > before && (await state()).person === null, 'watching does not stop the agent');
      await capture(`${n}-1-katselet`);

      // Taking control, explicitly; then giving it back.
      await inSheet('take-control').click();
      ok((await sheet().getAttribute('data-mode')) === 'control', 'control after taking');
      const p = (await state()).person;
      ok(d === 2 ? typeof p === 'number' : p === 'all', `control scope ${p}`);
      ok(await count('view-only') === 0, 'the screen takes input');
      await page.waitForTimeout(600);
      await capture(`${n}-2-otit`);
      const at = await state();
      await page.waitForTimeout(3300);
      const later = await state();
      if (d === 2) ok(later.osto.step > at.osto.step || JSON.stringify(later.osto.ptr) !== JSON.stringify(at.osto.ptr), 'riff 3: the agent works on elsewhere');
      else ok(later.osto.step === at.osto.step, 'the agent waits while the person holds the browser');
      await inSheet('hand-back').click();
      ok((await state()).person === null, 'handed back');
      await closeSheet();

      // The request's own action; the code needs control; hand back from the strip.
      await scene('rb-asking');
      await id('ask-action').click();
      await sheet().waitFor(); checks++;
      ok((await state()).sheetWin === 0, 'the sheet opens on the asking window');
      if (d === 0) {
        ok((await sheet().getAttribute('data-mode')) === 'watch' && (await state()).person === null, 'riff 1: the request opens watching');
        await capture(`${n}-3-pyynto`);
        await inSheet('take-control').click();
      } else await capture(`${n}-3-pyynto`);
      const pc = (await state()).person;
      ok(d === 2 ? pc === 0 : pc === 'all', `control after the request ${pc}`);
      await inSheet('site-code').fill('482913');
      await inSheet('site-verify').click();
      await until(() => window.rbStore.osto.wins[0].page === 'list'); checks++;
      await page.waitForTimeout(400);
      await capture(`${n}-4-vahvistettu`);
      await closeSheet();
      ok(await count('win-ask') === 0, 'the request is gone');
      if (d === 2) { await id('hand-back-win').waitFor(); checks++; }
      else { await id('hand-back').waitFor(); checks++; }
      await capture(`${n}-5-ohjaat`);
      await (d === 2 ? id('hand-back-win') : id('hand-back')).click();
      ok((await state()).person === null, 'handed back from the strip');
      await until(() => window.rbStore.osto.step > 7); checks++;
      await page.waitForTimeout(600);
      await capture(`${n}-6-jatkaa`);

      // Riff 2: a smaller picture is shown larger in the strip, still watching.
      if (d === 1) {
        await scene('rb-working');
        await page.locator('.rb-strip-pics [data-testid="win-pic"]:visible').last().click();
        ok((await state()).big >= 0 && (await state()).person === null, 'larger picture, still watching');
        await id('follow-agent').waitFor(); checks++;
        await capture(`${n}-7-isompi`);
        await id('follow-agent').click();
        ok((await state()).big === -1, 'follows the agent again');
      }

      // The waiting conversation.
      await scene('rb-working');
      await view('rekry');
      await id('move-here').waitFor(); checks++;
      ok(await count('win-pic') === 3, 'sees the driving conversation\'s windows');
      await view('osto');

      // The browser's row in the rail opens the sheet.
      await scene('rb-asking');
      if (mobile) { await id('navigation-open').click(); await id('rail-browser').waitFor(); checks++; await page.waitForTimeout(400); }
      await capture(`${n}-8-rivi`);
      await id('rail-browser').click();
      await sheet().waitFor(); checks++;
      ok((await sheet().getAttribute('data-mode')) === 'watch', 'the rail row opens watching');
      await closeSheet();

      // Finished while the other conversation drives; then free.
      await scene('rb-done');
      ok((await state()).osto.state === 'done', 'done');
      await until(() => window.rbStore.holder === null, 20000); checks++;
      await fits();
    }
    await page.close();
  }
  assert.deepEqual(errors, [], 'console errors');
  console.log(`${checks} checks, console clean`);
} finally {
  await browser.close();
}
