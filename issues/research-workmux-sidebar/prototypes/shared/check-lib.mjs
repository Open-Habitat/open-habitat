// Shared harness for the rounds' check.mjs: builds the page, opens it offline at device scale
// factor 2 in desktop and phone widths, light and dark, collects console errors and network
// requests, and writes screenshots to <round>/evidence/ with the picker hidden.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '../../../..');
const { checkPicker } = await import(path.join(root, 'design-system/prototypes/picker-check.mjs'));
// A worker may reuse the source checkout's installed browser tools, read-only.
const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).trim();
let require = createRequire(path.join(root, 'web/package.json'));
try { require.resolve('playwright'); } catch { require = createRequire(path.join(path.dirname(common), 'web/package.json')); }
const { chromium } = require('playwright');

export const SIZES = [[1440, 900, 'desktop'], [390, 844, 'phone']];
export async function run(dir, round, body) {
  execFileSync('node', [path.join(here, 'build.mjs'), dir], { stdio: 'inherit' });
  const evidence = path.join(dir, 'evidence'); mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch();
  const errors = [], requests = [];
  let cases = 0;
  try {
    for (const [width, height, size] of SIZES) for (const theme of ['light', 'dark']) {
      const p = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: 'reduce' });
      p.on('pageerror', e => errors.push(e.message));
      p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      p.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
      await p.goto('file://' + path.join(dir, 'index.html'));
      await p.evaluate(() => document.fonts.ready);
      assert.equal(await p.locator('html').getAttribute('data-theme'), theme);
      await checkPicker(p, round);
      const t = {
        p, size, theme, phone: size === 'phone',
        // Desktop-light and phone-dark get every step; the other two get the key views.
        pair: (size === 'desktop') === (theme === 'light'),
        async pick(v) { await p.locator('.proto-picker-item').nth(v).click(); await p.locator('.app[data-variant]').waitFor(); await p.waitForTimeout(30); },
        async fit(what) { assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${what}: horizontal overflow`); },
        async shot(file, always = false) {
          if (!always && !t.pair) return;
          await p.locator('.proto-picker').evaluate(n => { n.style.visibility = 'hidden'; });
          await p.screenshot({ path: path.join(evidence, `${file}-${size}-${theme}.png`), animations: 'disabled' });
          await p.locator('.proto-picker').evaluate(n => { n.style.visibility = ''; });
        },
        async scene(s) { await p.selectOption('#scene', s); },
        async drawer() { if (size === 'phone' && !(await p.locator('.app[data-drawer]').count())) await p.locator('[data-testid="menu"]').click(); },
        async closeDrawer() { if (await p.locator('.app[data-drawer]').count()) await p.keyboard.press('Escape'); },
      };
      await body(t);
      cases++;
      await p.close();
    }
  } finally { await browser.close(); }
  assert.deepEqual(errors, [], 'console errors');
  assert.deepEqual(requests, [], 'network requests');
  console.log(`ok: ${cases} width/theme cases, screenshots in ${evidence}`);
}
