// Checks the built round page offline: every direction × scene at 1440 and 390 px in light and
// dark. The ring opens the detail, the title takes focus, nothing overflows horizontally, the
// detail stays on screen, no text says undefined/NaN/null, the numbers agree with each other,
// disclosures open, Escape closes and returns focus to the ring, the picker holds, and the
// page logs no errors and makes no network requests. Screenshots at device scale factor 2.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-10-26-kontekstin-erittely/verify.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPicker } from '../../picker-check.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const require = createRequire(path.join(root, 'web/package.json'));
const { chromium } = require('@playwright/test');

const page = path.join(root, 'issues/proto-context-detail/prototypes/context-detail/index.html');
const out = path.join(root, 'issues/proto-context-detail/prototypes/context-detail/evidence');
execFileSync('node', [path.join(root, 'design-system/prototypes/build.mjs'), here, '--out', page], {stdio: 'inherit'});
rmSync(out, {recursive: true, force: true}); mkdirSync(out, {recursive: true});

const NAMES = ['ponnahdus', 'paneeli', 'kartta', 'sivu'];
const DETAIL = ['.cd-host:not([hidden])', '.cd-side:not([hidden])', '.cd-map', '.cd-page'];
const ALL = ['near', 'limit', 'early', 'after', 'nowindow'];
// A reviewable subset; every case is still asserted.
const SHOT = {'desktop-light': ['near', 'after', 'nowindow', 'early'], 'desktop-dark': ['limit'], 'phone-light': ['near', 'after'], 'phone-dark': ['limit']};
const browser = await chromium.launch();
const errors = [], requests = [];
let cases = 0;
const watch = (p) => {
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
};
const pick = (p, v) => p.locator('.proto-picker-item:not(.proto-picker-replay)').nth(v).click();
async function shoot(p, file) {
  await p.locator('.proto-picker').evaluate(n => { n.style.visibility = 'hidden'; });
  await p.locator('.frame').screenshot({path: file});
  await p.locator('.proto-picker').evaluate(n => { n.style.visibility = ''; });
}
try {
  for (const [width, size] of [[1440, 'desktop'], [390, 'phone']]) for (const theme of ['light', 'dark']) {
    const p = await browser.newPage({viewport: {width, height: 1150}, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: 'reduce'});
    watch(p);
    await p.goto('file://' + page);
    await p.selectOption('#theme', theme);
    if (width === 390) await p.check('#phone');
    await p.evaluate(() => document.fonts.ready);
    await checkPicker(p, '2026-10-26-kontekstin-erittely');
    for (let v = 0; v < 4; v++) {
      await pick(p, v);
      for (const scene of ALL) {
        const tag = `${NAMES[v]} ${scene} ${width} ${theme}`;
        await p.selectOption('#ctx-scene', scene);
        const ring = p.locator('[data-ctx]');
        await ring.waitFor();
        await ring.click();
        const d = p.locator(DETAIL[v]);
        await d.waitFor();
        await p.waitForFunction(() => document.activeElement?.id === 'cd-title', null, {timeout: 3000}).catch(async () => assert.fail(`${tag}: title not focused, active ${await p.evaluate(() => document.activeElement?.outerHTML.slice(0, 80) + ' ' + JSON.stringify(document.querySelector('.cd-pagehost')?.hidden) + document.querySelectorAll('#cd-title').length)}`));
        assert.equal(await ring.getAttribute('aria-expanded'), 'true', `${tag}: ring expanded`);
        const text = await d.innerText();
        assert.ok(!/undefined|NaN|null|Infinity/.test(text), `${tag}: bad text ${text.match(/.{0,40}(undefined|NaN|null|Infinity).{0,20}/)?.[0]}`);
        for (const want of ['Ohjeet', 'Työkalu', 'Keskustelu']) assert.ok(text.includes(want), `${tag}: missing ${want}`);
        if (scene === 'after') assert.match(text, /arvio/, `${tag}: after shows an estimate`);
        if (scene === 'nowindow') assert.ok(!/\d\s%\s/.test(text.split('\n')[1] || ''), `${tag}: no share without a window`);
        for (const sel of ['.topbar', '.frame', 'body']) assert.ok(await p.locator(sel).first().evaluate(n => n.scrollWidth <= n.clientWidth + 1), `${tag}: ${sel} overflows`);
        const fr = await p.locator('.frame').boundingBox(), bx = await d.boundingBox();
        assert.ok(bx.x >= fr.x - 1 && bx.x + bx.width <= fr.x + fr.width + 1, `${tag}: detail off the frame`);
        assert.ok(await d.evaluate(n => [...n.querySelectorAll('*')].every(e => e.scrollWidth <= e.clientWidth + 1 || getComputedStyle(e).overflowX !== 'visible' || e.closest('.cd-tablewrap'))), `${tag}: content overflows inside the detail`);
        // The category rows add up to the headline number (or to the estimate after a compaction).
        const sum = await p.evaluate(() => { const d = window.__cd.derive(document.querySelector('#ctx-scene').value); return [d.cats.reduce((a, c) => a + c.t, 0), d.total ?? d.estimate]; });
        assert.equal(sum[0], sum[1], `${tag}: categories ${sum[0]} ≠ total ${sum[1]}`);
        if (SHOT[`${size}-${theme}`].includes(scene)) await shoot(p, `${out}/${v + 1}-${NAMES[v]}-${size}-${theme}-${scene}.png`);
        // Disclosures: the first one opens its panel.
        const first = d.locator('[aria-expanded="false"][aria-controls]').first();
        if (await first.count()) {
          const id = await first.getAttribute('aria-controls');
          const disc = d.locator(`[aria-controls="${id}"]`);
          await disc.click();
          assert.equal(await disc.getAttribute('aria-expanded'), 'true', `${tag}: disclosure opens`);
          assert.ok(await p.locator('#' + id).isVisible(), `${tag}: disclosed panel visible`);
          if (scene === 'near' && theme === 'light') await shoot(p, `${out}/${v + 1}-${NAMES[v]}-${size}-${theme}-${scene}-open.png`);
        }
        await p.keyboard.press('Escape');
        assert.equal(await d.isVisible().catch(() => false), false, `${tag}: Escape closes`);
        await p.waitForFunction(() => document.activeElement?.hasAttribute('data-ctx'), null, {timeout: 3000}).catch(() => assert.fail(`${tag}: focus returns to the ring`));
        cases++;
      }
    }
    await p.close();
  }
  // Closed state for reference: the ring in the top bar, nothing open.
  const p = await browser.newPage({viewport: {width: 1440, height: 1150}, deviceScaleFactor: 2, colorScheme: 'light', reducedMotion: 'reduce'});
  watch(p);
  await p.goto('file://' + page);
  await p.locator('[data-ctx]').waitFor();
  await shoot(p, `${out}/0-closed-desktop-light.png`);
  await p.close();
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  console.log(`PASS: ${cases} direction×scene×size×theme cases; focus in and out; disclosures; numbers add up; picker; no console errors or network requests.`);
} finally { await browser.close(); }
