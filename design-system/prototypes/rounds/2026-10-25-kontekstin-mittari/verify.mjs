// Checks the built round page offline: every direction × scene at 1440 and 390 px in light
// and dark, no horizontal overflow, the popover opens and returns focus, the growth replay
// reaches compaction and its end, reduced motion stops the animations, the picker holds,
// and the page logs no errors and makes no network requests. Writes screenshots to evidence/.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-10-25-kontekstin-mittari/verify.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPicker } from '../../picker-check.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
// A worker may reuse the source checkout's installed browser tools, read-only.
const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {cwd: root, encoding: 'utf8'}).trim();
let require = createRequire(path.join(root, 'web/package.json'));
try { require.resolve('playwright'); } catch { require = createRequire(path.join(path.dirname(common), 'web/package.json')); }
const { chromium } = require('playwright');

const page = path.join(root, 'issues/proto-context-basic/prototypes/context-basic/index.html');
const out = path.join(root, 'issues/proto-context-basic/prototypes/context-basic/evidence');
execFileSync('node', [path.join(root, 'design-system/prototypes/build.mjs'), here, '--out', page], {stdio: 'inherit'});
rmSync(out, {recursive: true, force: true}); mkdirSync(out, {recursive: true});

const NAMES = ['rengas', 'sirussa', 'kentassa', 'sanoin'];
// A reviewable subset; every case is still asserted.
const SHOT = {'desktop-light': ['mid', 'limit', 'compacting', 'after', 'nowindow', 'popover'], 'desktop-dark': ['near'], 'phone-light': ['limit', 'after', 'popover'], 'phone-dark': ['mid']};
const ALL = ['start', 'mid', 'near', 'limit', 'compacting', 'after', 'settled', 'big', 'bignear', 'nowindow', 'noauto', 'fresh'];
const browser = await chromium.launch();
const errors = [], requests = [];
let cases = 0;
const watch = (p) => {
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
};
async function pick(p, v) { await p.locator('.proto-picker-item:not(.proto-picker-replay)').nth(v).click(); }
const frame = (p) => p.locator('.frame');
// The floating picker covers the phone composer in an element shot; hide it for the shot only.
async function shoot(p, key, scene, file) {
  if (!SHOT[key].includes(scene)) return;
  await p.locator('.proto-picker').evaluate(n => { n.style.visibility = 'hidden'; });
  await frame(p).screenshot({path: file});
  await p.locator('.proto-picker').evaluate(n => { n.style.visibility = ''; });
}
try {
  for (const [width, size] of [[1440, 'desktop'], [390, 'phone']]) for (const theme of ['light', 'dark']) {
    const p = await browser.newPage({viewport: {width, height: 1100}, colorScheme: theme, reducedMotion: 'reduce'});
    watch(p);
    await p.goto('file://' + page);
    await p.selectOption('#theme', theme);
    if (width === 390) await p.check('#phone');
    await p.evaluate(() => document.fonts.ready);
    await checkPicker(p, '2026-10-25-kontekstin-mittari');
    for (let v = 0; v < 4; v++) {
      await pick(p, v);
      for (const scene of ALL) {
        await p.selectOption('#ctx-scene', scene);
        const ind = p.locator('[data-ctx]');
        if (scene === 'fresh') assert.equal(await ind.count(), 0, `${NAMES[v]} ${scene}: no indicator before a reply`);
        else {
          assert.equal(await ind.count(), 1, `${NAMES[v]} ${scene} ${width}: one indicator`);
          assert.ok(await ind.isVisible(), `${NAMES[v]} ${scene} ${width}: indicator visible`);
          const label = await ind.getAttribute('aria-label');
          assert.ok(label.length > 20 && !/undefined|NaN|null/.test(label), `${NAMES[v]} ${scene}: label ${label}`);
          const text = await ind.textContent();
          assert.ok(!/undefined|NaN|null/.test(text), `${NAMES[v]} ${scene}: text ${text}`);
        }
        for (const sel of ['.topbar', '.composer', 'body']) assert.ok(await p.locator(sel).first().evaluate(n => n.scrollWidth <= n.clientWidth + 1), `${NAMES[v]} ${scene} ${width}: ${sel} overflows`);
        const box = await ind.boundingBox().catch(() => null);
        if (box) assert.ok(box.x >= 0 && box.x + box.width <= width, `${NAMES[v]} ${scene} ${width}: indicator off screen`);
        await shoot(p, `${size}-${theme}`, scene, `${out}/${v + 1}-${NAMES[v]}-${size}-${theme}-${scene}.png`);
        cases++;
      }
      // Popover: opens from the indicator, takes focus, Escape returns it.
      await p.selectOption('#ctx-scene', 'near');
      await p.locator('[data-ctx]').click();
      await p.locator('.ctx-pop:not([hidden])').waitFor();
      assert.equal(await p.evaluate(() => document.activeElement?.id), 'ctx-pop-title');
      assert.ok(await p.locator('.ctx-pop').evaluate(n => { const r = n.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0; }), `${NAMES[v]} ${width}: popover off screen`);
      await shoot(p, `${size}-${theme}`, 'popover', `${out}/${v + 1}-${NAMES[v]}-${size}-${theme}-popover.png`);
      await p.keyboard.press('Escape');
      assert.ok(await p.locator('.ctx-pop').isHidden());
      assert.equal(await p.evaluate(() => document.activeElement?.hasAttribute('data-ctx')), true, `${NAMES[v]}: focus returns to indicator`);
      if (width === 1440) assert.deepEqual(await p.locator('.frame').evaluate(n => n.getAnimations({subtree: true}).filter(a => /^ctx-/.test(a.animationName)).map(a => a.animationName)), [], 'reduced motion stops ctx animations');
    }
    await p.close();
  }
  // Replay: growth reaches compaction, the unknown state, then the new number; announcements follow.
  const p = await browser.newPage({viewport: {width: 1440, height: 1100}});
  watch(p);
  await p.goto('file://' + page);
  for (let v = 0; v < 4; v++) {
    await pick(p, v);
    await p.locator('#ctx-play').click();
    await p.locator('[data-ctx][data-level="critical"]').waitFor({timeout: 8000});
    await p.locator('[data-ctx][data-level="compacting"]').waitFor({timeout: 8000});
    if (v === 0) await frame(p).screenshot({path: `${out}/replay-compacting-animated.png`});
    await p.locator('[data-ctx][data-level="after"]').waitFor({timeout: 8000});
    assert.match(await p.locator('#ctx-announce').textContent(), /tiivistettiin/);
    await p.locator('[data-ctx][data-level="ok"]').waitFor({timeout: 8000});
    assert.match(await p.locator('[data-ctx]').getAttribute('aria-label'), /12\s%/);
    assert.match(await p.locator('#ctx-announce').textContent(), /Konteksti 12\s%/);
  }
  await p.close();
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  console.log(`PASS: ${cases} direction×scene×size×theme cases; popover focus in/out; replay to compaction and back; reduced motion; picker; no console errors or network requests.`);
} finally { await browser.close(); }
