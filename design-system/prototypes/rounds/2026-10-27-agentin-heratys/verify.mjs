// Builds the round into its issue and checks it offline: every direction at 1440 and 390 px in
// light and dark shows the resting state with its catch-up; each trigger wakes the agent once
// (typing starts Pi before the send, the button, the opening countdown) and leaves the cause
// marker and the woken turn; Älä herätä holds the countdown; the per-run switch wakes the
// agent when that run settles; nothing overflows; no console errors or network requests.
// Screenshots at device scale factor 2 into the issue's evidence directory.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-10-27-agentin-heratys/verify.mjs
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

const dir = path.join(root, 'issues/proto-wake-stopped-agent/prototypes/wake');
const page = path.join(dir, 'index.html');
const out = path.join(dir, 'evidence');
execFileSync('node', [path.join(root, 'design-system/prototypes/build.mjs'), here, '--out', page], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });

const NAMES = ['kirjoittaessa', 'painike', 'avatessa'];
const browser = await chromium.launch();
const errors = [], requests = [];
const watch = (p) => {
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
};
const pick = async (p, v) => { await p.locator('.proto-picker-item:not(.proto-picker-replay)').nth(v).click(); await p.locator(`.wk-dir-${['type', 'button', 'open'][v]}`).waitFor(); await p.waitForTimeout(500); };
const hidePicker = (p, on) => p.locator('.proto-picker').evaluate((n, on) => { n.style.visibility = on ? 'hidden' : ''; }, on);
async function shoot(p, file) { await hidePicker(p, true); await p.locator('.frame').screenshot({ path: path.join(out, file) }); await hidePicker(p, false); }
async function noOverflow(p, tag) {
  for (const sel of ['.topbar', '.frame', 'body', '#stage', '.composer', '.wk-card']) {
    const loc = p.locator(sel).first(); if (!(await loc.count())) continue;
    assert.ok(await loc.evaluate(n => n.scrollWidth <= n.clientWidth + 1), `${tag}: ${sel} overflows`);
  }
}
const phase = (p) => p.evaluate(() => window.__wk.W.phase);
const settledTurn = (p) => p.waitForSelector('.turn.live:not(.working)', { timeout: 60000 });
async function woke(p, tag, cause) {
  await p.locator('.wk-marker').waitFor();
  assert.match(await p.locator('.wk-marker > span').innerText(), cause, `${tag}: marker names the cause`);
  assert.equal(await p.locator('.wk-marker').count(), 1, `${tag}: woken once`);
  assert.equal(await p.locator('.wk-card').count(), 0, `${tag}: the card gives way to the marker`);
  await settledTurn(p);
  assert.match(await p.locator('.turn.live .bubble.reply').innerText(), /Huomenta/, `${tag}: woken turn replies`);
}
let cases = 0;
try {
  for (const [width, size] of [[1440, 'desktop'], [390, 'phone']]) for (const theme of ['light', 'dark']) {
    const p = await browser.newPage({ viewport: { width, height: 1100 }, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: 'reduce' });
    watch(p);
    await p.goto('file://' + page);
    await p.selectOption('#theme', theme);
    if (width === 390) await p.check('#phone');
    await p.evaluate(() => document.fonts.ready);
    await checkPicker(p, '2026-10-27-agentin-heratys');
    await p.addStyleTag({ content: `.frame{height:${width === 390 ? 1500 : 1180}px!important}` });
    const flows = theme === 'light';
    const shot = (v, s) => shoot(p, `${v + 1}-${NAMES[v]}-${size}-${theme}${s ? '-' + s : ''}.png`);
    for (let v = 0; v < 3; v++) {
      const tag = `${NAMES[v]} ${size} ${theme}`;
      await pick(p, v);
      await noOverflow(p, tag);
      const text = await p.locator('.frame').innerText();
      assert.ok(!/undefined|NaN|\bnull\b/.test(text), `${tag}: bad text`);
      assert.equal(await phase(p), 'stopped', `${tag}: starts resting`);
      assert.match(await p.locator('.topbar .wk-chip').textContent(), /Lepää/, `${tag}: top bar says Lepää`);
      await shot(v);
      if (v === 0) {
        await p.locator('[data-wk="more"]').click();
        assert.equal(await p.locator('.wk-row .wk-run').count(), 5, `${tag}: four settled and one running`);
        await noOverflow(p, tag + ' open');
        await shot(v, 'auki');
        if (flows) {
          await p.locator('.composer textarea').pressSequentially('Huomenta. Mitä yöllä valmistui?', { delay: 5 });
          assert.equal(await phase(p), 'starting', `${tag}: typing starts Pi`);
          await shot(v, 'kaynnistyy');
          await p.waitForFunction(() => window.__wk.W.phase === 'warm');
          assert.match(await p.locator('.wk-row').innerText(), /hereillä/, `${tag}: Pi awake before the send`);
          await shot(v, 'hereilla');
          await p.keyboard.press('Enter');
          await woke(p, tag, /Viestisi herätti/);
          await shot(v, 'herannyt');
        }
      }
      if (v === 1) {
        assert.equal(await p.locator('.wk-card .wk-run').count(), 5, `${tag}: catch-up in the card`);
        if (flows) {
          await p.locator('[data-wk="arm"]').click();
          assert.equal(await p.locator('[data-wk="arm"]').getAttribute('aria-checked'), 'true', `${tag}: switch on`);
          assert.equal(await phase(p), 'stopped', `${tag}: arming does not wake`);
          await shot(v, 'viritetty');
          await p.locator('[data-wk="settle"]').click();
          await woke(p, tag, /Hakuindeksin valmistuminen/);
          await shot(v, 'herannyt-valmistumiseen');
          await pick(p, v);
          await p.locator('[data-wk="wake"]').click();
          assert.equal(await phase(p), 'starting', `${tag}: button starts Pi`);
          await woke(p, tag, /Herätit agentin/);
          await shot(v, 'herannyt');
        }
      }
      if (v === 2) {
        assert.ok(await p.locator('.wk-count').isVisible(), `${tag}: countdown shown`);
        if (flows) {
          await p.locator('[data-wk="hold"]').click();
          await p.waitForTimeout(7000);
          assert.equal(await phase(p), 'stopped', `${tag}: Älä herätä holds`);
          await shot(v, 'pidatetty');
          await pick(p, v);
          await woke(p, tag, /avasit keskustelun/);
          await shot(v, 'herannyt');
        }
      }
      cases++;
    }
    await p.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  console.log(`PASS: ${cases} direction×size×theme cases; typing, button, opening and the per-run switch each wake once with their cause; Älä herätä holds; picker; no overflow, console errors or network requests.`);
} finally { await browser.close(); }
