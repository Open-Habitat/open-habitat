// Builds the round and checks it offline: every direction at 1440 and 390 px in light and dark,
// in all three host situations. Pi in tmux: Kerro shows the attach command, Katso opens a read-only
// mirror that refuses keys, Jatka attaches and a typed message reaches the history; quitting Pi in
// the SSH terminal turns the conversation to rest. Pi without tmux: Katso and Jatka are blocked with
// a reason. Pi closed: Kerro copies the resume command, Katso stages it for Enter, Jatka resumes it
// in a browser shell. The picker holds, nothing overflows, no console errors or network requests.
// Screenshots at device scale factor 2 into evidence/ (PNG; convert with scripts/screenshots-to-avif.py).
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright NODE_PATH=<checkout>/web/node_modules \
//     node issues/proto-open-in-terminal/prototypes/avaa-paatteessa/verify.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const { checkPicker } = await import(path.join(root, 'design-system/prototypes/picker-check.mjs'));
const req = createRequire(existsSync(path.join(root, 'web/node_modules')) ? path.join(root, 'web/package.json') : path.join(process.env.NODE_PATH || '', 'x.js'));
const { chromium } = req('@playwright/test');

const page = path.join(here, 'index.html');
const out = path.join(here, 'evidence');
execFileSync('node', [path.join(root, 'design-system/prototypes/build.mjs'), here, '--out', page], { stdio: 'inherit' });
mkdirSync(out, { recursive: true });

const NAMES = ['kerro', 'katso', 'jatka'];
const DIRS = ['tell', 'watch', 'take'];
const browser = await chromium.launch();
const errors = [], requests = [];
const watch = (p) => {
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
};
const pick = async (p, v) => {
  await p.locator('.proto-picker-item:not(.proto-picker-replay)').nth(v).click();
  await p.waitForFunction((d) => document.querySelector('.frame').dataset.otDir === d && document.querySelector('.ro-foot'), DIRS[v]);
};
const scen = async (p, s) => { await p.selectOption('#ot-scen', s); await p.waitForFunction((s) => document.querySelector('.frame').dataset.otScen === s, s); };
// The picker and a passing toast are not part of the state being shown.
const hidePicker = (p, on) => p.evaluate((on) => { for (const n of document.querySelectorAll('.proto-picker, .toast')) n.style.visibility = on ? 'hidden' : ''; }, on);
async function shoot(p, file) {
  await hidePicker(p, true); await p.locator('.frame').screenshot({ path: path.join(out, file) }); await hidePicker(p, false);
}
async function noOverflow(p, tag) {
  for (const sel of ['.frame', 'body', '.topbar', '.ro-foot', '.sh-bar', '.ot-banner']) {
    const loc = p.locator(sel).first(); if (!(await loc.count()) || !(await loc.isVisible())) continue;
    assert.ok(await loc.evaluate(n => n.scrollWidth <= n.clientWidth + 1), `${tag}: ${sel} overflows`);
  }
  const tb = await p.locator('.topbar').evaluate(n => n.getBoundingClientRect().height);
  assert.ok(tb < 70, `${tag}: top bar stays one row (${tb}px)`);
}
const foot = (p) => p.locator('.ro-foot').innerText();
const settle = (p) => p.waitForFunction(() => !window.__ot.OT.tui.working, null, { timeout: 10000 });

let cases = 0;
try {
  for (const [width, size] of [[1440, 'desktop'], [390, 'phone']]) for (const theme of ['light', 'dark']) {
    const phone = width === 390;
    const p = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: 'reduce' });
    watch(p);
    await p.goto('file://' + page);
    await p.selectOption('#theme', theme);
    if (phone) await p.check('#phone');
    await p.evaluate(() => document.fonts.ready);
    await checkPicker(p, 'proto-open-in-terminal/avaa-paatteessa');
    for (let v = 0; v < 3; v++) {
      const tag = `${NAMES[v]} ${size} ${theme}`, n = (s) => `${v + 1}-${NAMES[v]}-${s}-${size}-${theme}.png`;
      await pick(p, v);
      // ---- Pi running in the person's tmux over SSH.
      await scen(p, 'tmux');
      assert.match(await foot(p), /Käynnissä päätteessä/, `${tag}: footer says it runs in a terminal`);
      assert.match(await foot(p), /work/, `${tag}: footer names the tmux session`);
      assert.ok(await p.locator('.conv-row[data-conv="ct"] .ot-st').count(), `${tag}: sidebar marks the terminal conversation`);
      if (v === 0) {
        assert.match(await foot(p), /tmux attach -t work:2/, `${tag}: attach command`);
        await p.locator('.ro-foot [data-ot^="copy:"]').click();
        await p.waitForFunction(() => document.querySelector('.toast.on')?.textContent.includes('kopioitu'));
        assert.equal(await p.locator('.sh-dock').isVisible(), false, `${tag}: Kerro opens nothing`);
      } else if (v === 1) {
        await p.getByRole('button', { name: 'Katso päätteessä' }).click();
        assert.ok(await p.locator('.sh-tab.on[data-kind="mirror"] .ot-ro').isVisible(), `${tag}: mirror tab is read-only`);
        await p.locator('.ot-term').press('x');
        assert.ok(await p.locator('.ot-nudge').isVisible(), `${tag}: mirror says keys do not go in`);
        assert.equal(await p.locator('.ot-term').getAttribute('aria-readonly'), 'true', `${tag}: mirror is aria-readonly`);
      } else {
        await p.getByRole('button', { name: 'Jatka päätteessä' }).click();
        assert.ok(await p.locator('.sh-tab.on[data-kind="attach"] .ot-ro.shared').isVisible(), `${tag}: attached tab says shared`);
        await settle(p);
        await p.locator('.ot-term').pressSequentially('Kokeile --until 2026-10-20');
        await p.locator('.ot-term').press('Enter');
        await p.waitForFunction(() => document.querySelectorAll('.ot-extra').length === 1);
        await settle(p);
      }
      await settle(p);
      if (phone && v > 0) assert.equal(await p.locator('.stream').isVisible(), false, `${tag}: on a phone the panel takes the column`);
      await noOverflow(p, `${tag} tmux`);
      await shoot(p, n('tmux')); cases++;
      // The person quits Pi in their SSH terminal.
      await p.click('#ot-quit');
      await p.waitForFunction(() => document.querySelector('.frame').dataset.otScen === 'ended');
      if (v > 0) {
        assert.ok(await p.locator('.sh-tab.on .sh-prompt').isVisible(), `${tag}: the tmux tab returns to a prompt`);
        if (phone) await p.locator('.sh-back').click();
      }
      assert.match(await foot(p), /suljettu/, `${tag}: footer follows the quit`);
      // ---- Pi in a terminal without tmux.
      await scen(p, 'bare');
      assert.match(await foot(p), /ilman tmuxia/, `${tag}: says no tmux`);
      if (v > 0) assert.equal(await p.locator('.ro-foot .primary').getAttribute('aria-disabled'), 'true', `${tag}: blocked without tmux`);
      await noOverflow(p, `${tag} bare`);
      await shoot(p, n('ilman-tmuxia')); cases++;
      // ---- Pi closed: continue.
      await scen(p, 'ended');
      if (v === 0) {
        assert.match(await foot(p), /pi --session 019a3c7e/, `${tag}: resume command`);
        await p.getByRole('button', { name: 'Avaa pääte' }).click();
        assert.ok(await p.locator('.sh-tab.on[data-kind="shell"]').isVisible(), `${tag}: a plain shell opens`);
      } else if (v === 1) {
        await p.getByRole('button', { name: 'Avaa päätteessä' }).click();
        assert.match(await p.locator('.ot-term').innerText(), /pi --session 019a3c7e/, `${tag}: command waits at the prompt`);
        await shoot(p, n('valmisteltu')); cases++;
        await p.locator('.ot-term').press('Enter');
        await p.waitForFunction(() => document.querySelector('.sh-tab.on')?.dataset.kind === 'resume');
      } else {
        await p.getByRole('button', { name: 'Jatka päätteessä' }).click();
        await p.waitForFunction(() => document.querySelector('.sh-tab.on')?.dataset.kind === 'resume');
        if (!phone) assert.match(await foot(p), /selaimen päätteessä/, `${tag}: footer says it continues in the browser terminal`);
      }
      await noOverflow(p, `${tag} ended`);
      await shoot(p, n('suljettu')); cases++;
      // The picker still holds after all of this.
      await checkPicker(p, 'proto-open-in-terminal/avaa-paatteessa');
    }
    await p.close();
  }
  assert.deepEqual(errors, [], 'console stays clean');
  assert.deepEqual(requests, [], 'no network requests');
  console.log(`ok: ${cases} screenshots, 12 direction × size × theme passes`);
} finally {
  await browser.close();
}
