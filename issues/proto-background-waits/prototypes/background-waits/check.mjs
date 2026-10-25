// Builds index.html and checks it offline: every direction at 1440 and 390 px in light and
// dark, both chips open their panels, the ended rows and a completion note expand, stopping a
// wait turns its run into "no wait", nothing overflows sideways, the picker holds, and the
// page logs no errors and makes no network requests. Screenshots go to evidence/.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/proto-background-waits/prototypes/background-waits/check.mjs
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
const NOWAIT = '.pop .row[data-waited="false"], .pop .sub.nowait';
const NAMES = ['1-nyt', '2-sanoin', '3-pisteet', '4-sisakkain'];
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
let cases = 0;
try {
  for (const [width, height, size] of [[1440, 900, 'desktop'], [390, 844, 'phone']]) for (const theme of ['light', 'dark']) {
    const p = await browser.newPage({ viewport: { width, height }, colorScheme: theme, reducedMotion: 'reduce' });
    watch(p);
    await p.goto('file://' + path.join(here, 'index.html'));
    await p.evaluate(() => document.fonts.ready);
    assert.equal(await p.locator('html').getAttribute('data-theme'), theme);
    await checkPicker(p, 'proto-background-waits');
    for (let v = 0; v < 4; v++) {
      await p.locator('.proto-picker-item').nth(v).click();
      await p.locator(`.app[data-variant]`).waitFor();
      const key = `${NAMES[v]}-${size}-${theme}`;
      await p.selectOption('#scene', 'a');
      assert.equal(await p.locator('[data-testid="completion"]').count(), 3);
      await fit(p, key); await shot(p, key);
      // Workers panel: the run without a wait is visible as such (from direction 2 on).
      await p.locator('[data-testid="chip-spin"]').click();
      await p.locator('[data-testid="panel"]').waitFor();
      const text = await p.locator('[data-testid="panel"]').innerText();
      if (v === 0) assert.ok(!/odotusta/.test(text), 'Nyt shows no wait words');
      else assert.equal(await p.locator(NOWAIT).count(), 1, 'one run without a wait');
      await fit(p, key + ' spin'); await shot(p, key + '-workerit');
      // Processes panel with its ended rows open.
      await p.locator('.tab[data-kind="proc"]').click();
      await p.locator('.endfold[data-kind="proc"]').click();
      const procs = await p.locator('[data-testid="panel"]').innerText();
      if (v === 0) assert.match(procs, /odota-kastelu/); else assert.ok(!/odota-kastelu/.test(procs), 'wait hidden from terminals');
      assert.match(procs, /julkaisuvahti/);
      await fit(p, key + ' proc'); if (theme === 'light') await shot(p, key + '-prosessit');
      await p.keyboard.press('Escape');
      assert.equal(await p.locator('[data-testid="panel"]').count(), 0);
      assert.ok(await p.locator('[data-testid="chip-proc"]').evaluate(n => n === document.activeElement), 'Escape returns focus to the chip');
      // A completion note expands.
      await p.locator('[data-act="note"]').first().click();
      assert.equal(await p.locator('.pc-details').count(), 1);
      if (size === 'desktop' && theme === 'light') await shot(p, key + '-merkinta');
      await p.locator('[data-act="note"]').first().click();
      // Stopping a wait (directions 2–4): the run then reads "no wait".
      if (v > 0) {
        await p.selectOption('#scene', 'b');
        await p.locator('[data-testid="chip-spin"]').click();
        if (size === 'desktop' && theme === 'light') await shot(p, `${NAMES[v]}-kaikkia-odotetaan`);
        assert.equal(await p.locator(NOWAIT).count(), 0);
        await p.locator('[data-act="unwait"]').first().click();
        assert.equal(await p.locator(NOWAIT).count(), 1);
        await p.keyboard.press('Escape');
        await p.selectOption('#scene', 'c');
        assert.equal(await p.locator('.corner.wait').count(), 0, 'no bell while the agent works');
        if (size === 'desktop' && theme === 'light' && v === 2) await shot(p, `${NAMES[v]}-agentti-tyoskentelee`);
      }
      cases++;
    }
    await p.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  console.log(`PASS: ${cases} direction × width × theme cases; panels, ended rows, notes, stop-wait, Escape focus, no overflow, picker, no console errors or network requests.`);
} finally { await browser.close(); }
