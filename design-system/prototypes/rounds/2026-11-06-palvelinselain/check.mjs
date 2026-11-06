// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// every direction at 1440 and 390 light, the whole story: the default view
// (browser open on Netvisor's sign-in), the closed state with its entry
// point, opening it from the agent's request, signing in with the code,
// handing over, the agent working (view-only screen, its pointer, the steps
// in the conversation), taking control and handing back, Netvisor asking for
// the code again mid-task, entering it and handing back, and the finished
// task. Direction 2 also its log on a phone and the conversation behind the
// view. The defaults again at 1440 and 390 dark. Screenshots at device scale
// factor 2 named r1-<direction>-<step>-<width>-<theme>.png; the console must
// stay clean.
import {createRequire} from 'node:module';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync, mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, '../../../../web/package.json'));
const {chromium} = require('playwright');
const round = '2026-11-06-palvelinselain';
const [input, out] = process.argv.slice(2);
mkdirSync(out, {recursive: true});
const browser = await chromium.launch(process.env.PROTO_CHROMIUM ? {executablePath: process.env.PROTO_CHROMIUM} : {});
const names = ['1-rinnakkain', '2-oma-nakyma', '3-pyydettaessa'];
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
    const capture = async (name) => { await page.waitForTimeout(450); await page.screenshot({path: `${out}/r1-${name}-${tag}.png`}); };
    const fits = async () => ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'document overflow');
    const id = (x) => page.locator(`[data-testid="${x}"]:visible`).first();
    const count = (x) => page.getByTestId(x).count();
    const state = () => page.evaluate(() => ({...window.rbStore}));
    const until = (fn, timeout = 12000) => page.waitForFunction(fn, null, {timeout});
    const scrollEnd = () => page.evaluate(() => document.querySelectorAll('.ah-conversation-stream').forEach((el) => { el.scrollTop = el.scrollHeight; }));
    // The sheet is modal: the review bar behind it takes clicks only once it is closed.
    const bar = async (x) => {
      if (await count('browser-sheet')) { await page.keyboard.press('Escape'); await page.getByTestId('browser-sheet').waitFor({state: 'detached'}); }
      await id(x).click();
    };
    const signInWithCode = async () => {
      await id('site-code').fill('482913');
      await id('site-verify').click();
    };
    for (const d of [0, 1, 2]) {
      await page.locator('.proto-picker-item').nth(d).click();
      await page.locator(`.rb-review.variant-${d}`).waitFor({state: 'attached'});
      await bar('rb-reset');
      await page.waitForTimeout(200);
      const n = names[d];
      assert.match(await id('direction-lines').locator('li[aria-current]').innerText(), new RegExp(`^${d + 1} `)); checks++;
      // Default: the browser is open on the sign-in page, in this direction's place.
      await id('browser-screen').waitFor();
      ok(await count('side-pane') === (d === 0 ? 1 : 0), 'pane only in 1');
      ok(await count('browser-view') === (d === 1 ? 1 : 0), 'own view only in 2');
      ok(await count('browser-sheet') === (d === 2 ? 1 : 0), 'sheet only in 3');
      ok(d === 1 ? await count('rail-browser') === 1 : await count('rail-browser') === 0, 'rail entry only in 2');
      ok((await id('hand-over').isDisabled()), 'hand over waits for the sign-in');
      await fits();
      await capture(`${n}-0-oletus`);
      if (!run.full) continue;

      // Closed: where the person finds it again, then open it from the agent's request.
      await bar('rb-closed');
      await page.waitForTimeout(200);
      ok(await count('browser-screen') === 0, 'closed');
      await scrollEnd();
      await capture(`${n}-1-suljettu`);
      await id('request-open').click();
      await id('browser-screen').waitFor(); checks++;

      // Sign in: password page, then the code.
      await id('site-login').click();
      await id('site-code').waitFor(); checks++;
      await id('site-code').fill('482913');
      await capture(`${n}-2-koodi`);
      await id('site-verify').click();
      await until(() => window.rbStore.page === 'home'); checks++;
      ok(!(await id('hand-over').isDisabled()), 'hand over after sign-in');
      await capture(`${n}-3-kirjautunut`);

      // Hand over; the agent works and the screen is view-only.
      await id('hand-over').click();
      await until(() => window.rbStore.step >= 2); checks++;
      ok((await state()).driver === 'agent', 'agent drives');
      ok(await count('browser-sheet') === 0 || d !== 2, 'the sheet closes on hand-over');
      if (d === 2) { await id('live-card').waitFor(); checks++; }
      else { await id('view-only').waitFor(); checks++; }
      await scrollEnd();
      await capture(`${n}-4-agentti`);

      // Take control back, then hand it back.
      await id('take-control').click();
      ok((await state()).paused, 'paused');
      const stepAtPause = (await state()).step;
      await page.waitForTimeout(1400);
      ok((await state()).step === stepAtPause, 'agent waits while the person holds the browser');
      if (d === 2 && await count('browser-sheet') === 0) await id('live-watch').click();
      await scrollEnd();
      await capture(`${n}-5-otit`);
      await id('hand-over').click();

      // Mid-task: Netvisor asks for the code again; the agent asks the person.
      await until(() => window.rbStore.phase === 'asking'); checks++;
      await page.waitForTimeout(200);
      if (await count('browser-screen') === 0 || d === 1) {
        // The conversation's request is what the person sees first.
        if (d === 1) { await id('view-back').click(); }
        await scrollEnd();
        await id('request2').waitFor(); checks++;
        await capture(`${n}-6-pyytaa`);
        await id('request-open').click();
      } else {
        // Direction 1: the pane shows Netvisor's request; on a phone it covers the conversation.
        await scrollEnd();
        await page.getByTestId('request2').waitFor({state: 'attached'}); checks++;
        await capture(`${n}-6-pyytaa`);
      }
      await id('site-code').waitFor(); checks++;
      await signInWithCode();
      await until(() => window.rbStore.page === 'list'); checks++;
      await capture(`${n}-7-vahvistettu`);
      await id('hand-over').click();
      await until(() => window.rbStore.phase === 'done'); checks++;
      if (d === 1) {
        if (mobile) await page.getByTestId('view-tabs').getByText('Agentin toimet').click();
        await id('action-log').waitFor();
        ok(await count('log-row') === 7, 'log lists every step');
        await capture(`${n}-8-valmis`);
        await id('view-back').click();
        await id('browser-note').waitFor(); checks++;
        await scrollEnd();
        await capture(`${n}-9-keskustelu`);
      } else {
        if (d === 0 && mobile) await id('close-browser').click();
        await scrollEnd();
        await id('request2-done').waitFor(); checks++;
        await capture(`${n}-8-valmis`);
      }
      await fits();
    }
    await page.close();
  }
  assert.deepEqual(errors, [], 'console errors');
  console.log(`${checks} checks, console clean`);
} finally {
  await browser.close();
}
