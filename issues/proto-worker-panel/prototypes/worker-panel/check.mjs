// Builds index.html and checks it offline: every direction at 1440 and 390 px in light and
// dark, device scale factor 2. The worker pill opens the panel; there is no legend; every
// live row says whether the agent waits on it without one; the ended rows unfold; stopping a
// wait turns its row into "no wait"; Avattava's details open; a row opens the worker's own
// view and its back link returns; Escape closes the panel and returns focus; nothing
// overflows sideways; the picker holds; the page logs no errors and makes no requests.
// Screenshots go to evidence/.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/proto-worker-panel/prototypes/worker-panel/check.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const { checkPicker } = await import(path.join(root, 'design-system/prototypes/picker-check.mjs'));
// A worker may reuse the source checkout's installed browser tools, read-only.
const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).trim();
let require = createRequire(path.join(root, 'web/package.json'));
try { require.resolve('playwright'); } catch { require = createRequire(path.join(path.dirname(common), 'web/package.json')); }
const { chromium } = require('playwright');

execFileSync('node', [path.join(here, 'build.mjs')], { stdio: 'inherit' });
const evidence = path.join(here, 'evidence'); mkdirSync(evidence, { recursive: true });
const NAMES = ['1-rivi', '2-ryhmat', '3-avattava'];
const browser = await chromium.launch();
const errors = [], requests = [];
const watch = (p) => {
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
};
const fit = async (p, what) => assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${what}: horizontal overflow`);
async function shot(p, file) {
  await p.locator('.proto-picker').evaluate(n => { n.style.visibility = 'hidden'; });
  await p.screenshot({ path: path.join(evidence, file + '.png'), animations: 'disabled' });
  await p.locator('.proto-picker').evaluate(n => { n.style.visibility = ''; });
}
const panel = (p) => p.locator('[data-testid="panel"]');
let cases = 0;
try {
  for (const [width, height, size] of [[1440, 900, 'desktop'], [390, 844, 'phone']]) for (const theme of ['light', 'dark']) {
    const p = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: 'reduce' });
    watch(p);
    await p.goto('file://' + path.join(here, 'index.html'));
    await p.evaluate(() => document.fonts.ready);
    assert.equal(await p.locator('html').getAttribute('data-theme'), theme);
    await checkPicker(p, 'proto-worker-panel');
    const full = size === 'desktop' && theme === 'light';
    for (let v = 0; v < 3; v++) {
      await p.locator('.proto-picker-item').nth(v).click();
      await p.locator('.app[data-variant]').waitFor();
      const key = `${NAMES[v]}-${size}-${theme}`;
      await p.selectOption('#scene', 'a');
      // The closed pill: one mark per live worker, the preserved run's red dot.
      assert.equal(await p.locator('[data-testid="chip-spin"] .marks > *').count(), 4);
      assert.equal(await p.locator('[data-testid="chip-spin"] .corner.attn').count(), 1);
      await p.locator('[data-testid="chip-spin"]').click();
      await panel(p).waitFor();
      assert.equal(await p.locator('.legend').count(), 0, 'no legend at the top');
      const text = await panel(p).innerText();
      // The wait's meaning is readable without a legend: on the row, in a heading or in details.
      if (v === 0) { assert.match(text, /agentti odottaa/); assert.match(text, /agentti ei odota/); }
      if (v === 1) { assert.match(text, /Agentti jatkaa, kun nämä valmistuvat/); assert.match(text, /Agentti ei herää, kun nämä valmistuvat/); assert.match(text, /Työ tallessa/); }
      assert.match(text, /kirjasto/, 'the other repository is named');
      await fit(p, key); await shot(p, key + '-paneeli');
      if (v === 2) {
        await p.locator('.more[data-id="w2"]').click();
        assert.match(await p.locator('[data-testid="details"]').innerText(), /ei herää/);
        await fit(p, key + ' details'); await shot(p, key + '-tiedot');
        await p.locator('.more[data-id="w2"]').click();
        assert.equal(await p.locator('[data-testid="details"]').count(), 0);
      }
      // Ended rows.
      await p.locator('.endfold').click();
      assert.match(await panel(p).innerText(), /Kuvien pakkaus/);
      if (v !== 1) assert.match(await panel(p).innerText(), /Kasvilajien tuonti/);
      await fit(p, key + ' ended'); await shot(p, key + '-paattyneet');
      if (v === 2 && full) {
        await p.locator('.more[data-id="e2"]').click();
        await shot(p, key + '-tiedot-tallessa');
        await p.locator('.more[data-id="e2"]').click();
      }
      // Stopping a wait: Hakuindeksin päivitys then reads as not waited.
      const w3 = p.locator('.row[data-run="w3"]');
      assert.equal(await w3.getAttribute('data-waited'), 'true');
      if (v === 2) { await p.locator('.more[data-id="w3"]').click(); await p.locator('.details [data-act="unwait"]').click(); }
      else await w3.locator('[data-act="unwait"]').click();
      assert.equal(await p.locator('.row[data-run="w3"]').getAttribute('data-waited'), 'false');
      if (v === 1) assert.equal(await p.locator('[data-group="nowait"] .row[data-run="w3"]').count(), 1, 'moves to the no-wait group');
      await p.keyboard.press('Escape');
      assert.equal(await panel(p).count(), 0);
      assert.ok(await p.locator('[data-testid="chip-spin"]').evaluate(n => n === document.activeElement), 'Escape returns focus to the pill');
      // A row opens the worker's own view; Claude opens on the terminal; back returns.
      await p.locator('[data-testid="chip-spin"]').click();
      await p.locator('.row[data-run="w2"] .row-main').click();
      await p.locator('[data-testid="worker-view"]').waitFor();
      assert.equal(await p.locator('.wv-tabs [data-tab="term"]').getAttribute('aria-selected'), 'true');
      assert.equal(await p.locator('.composer').count(), 0, 'no composer in a worker view');
      await fit(p, key + ' worker');
      if (v === 0) await shot(p, `worker-${size}-${theme}`);
      await p.locator('.wv-back').click();
      assert.equal(await p.locator('[data-testid="worker-view"]').count(), 0);
      assert.ok(await p.locator('[data-testid="chip-spin"]').evaluate(n => n === document.activeElement), 'back returns focus to the pill');
      // Only ended workers: the pill goes idle, the panel says so.
      await p.selectOption('#scene', 'b');
      await p.locator('[data-testid="chip-spin"]').click();
      assert.match(await panel(p).innerText(), /Ei työskenteleviä workereita/);
      await fit(p, key + ' ended-only');
      if (full) await shot(p, key + '-vain-paattyneet');
      await p.keyboard.press('Escape');
      cases++;
    }
    await p.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  console.log(`PASS: ${cases} direction × width × theme cases; no legend, wait meaning readable, details, ended rows, stop-wait, worker view and back, Escape focus, no overflow, picker, no console errors or network requests.`);
} finally { await browser.close(); }
