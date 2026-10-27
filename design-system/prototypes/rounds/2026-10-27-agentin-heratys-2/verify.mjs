// Builds round 2 into its issue and checks it offline: every direction at 1440 and 390 px in
// light and dark shows the resting state with the host's report (stop time and cause, each
// settled run with Taskfleet's summary) before anything starts Pi; typing starts Pi without a
// turn and the send wakes it once, leaving the report as the thread's record and a woken turn
// that answers the message instead of retelling the night; a run settling while Pi rests
// updates the report; the stop cause changes the report's words; nothing overflows; no
// console errors or network requests. Screenshots at device scale factor 2 into the issue.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-10-27-agentin-heratys-2/verify.mjs
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

const dir = path.join(root, 'issues/proto-wake-stopped-agent/prototypes/wake-2');
const page = path.join(dir, 'index.html');
const out = path.join(dir, 'evidence');
execFileSync('node', [path.join(root, 'design-system/prototypes/build.mjs'), here, '--out', page], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });

const NAMES = ['kortti', 'aikajana', 'liitteena'];
const DIRS = ['card', 'time', 'attach'];
const REPORT = ['.wk-card', '.wk-time', '.wk-tray'];
const MESSAGE = 'Korjaa sivutuksen testi ja yhdistä CSV-vienti uudelleen.';
const browser = await chromium.launch();
const errors = [], requests = [];
const watch = (p) => {
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
};
const pick = async (p, v) => { await p.locator('.proto-picker-item:not(.proto-picker-replay)').nth(v).click(); await p.locator(`.wk-dir-${DIRS[v]}`).waitFor(); await p.waitForTimeout(500); };
const hidePicker = (p, on) => p.locator('.proto-picker').evaluate((n, on) => { n.style.visibility = on ? 'hidden' : ''; }, on);
async function shoot(p, file) { await hidePicker(p, true); await p.locator('.frame').screenshot({ path: path.join(out, file) }); await hidePicker(p, false); }
async function noOverflow(p, tag) {
  for (const sel of ['.topbar', '.frame', 'body', '#stage', '.composer', '.wk-card', '.wk-time', '.wk-tray', '.bubble.user']) {
    const loc = p.locator(sel).first(); if (!(await loc.count())) continue;
    assert.ok(await loc.evaluate(n => n.scrollWidth <= n.clientWidth + 1), `${tag}: ${sel} overflows`);
  }
}
const phase = (p) => p.evaluate(() => window.__wk.W.phase);
const report = (p, v) => p.locator(REPORT[v]).innerText();
async function typeAndWake(p, v, tag, shot) {
  await p.locator('.composer textarea').pressSequentially(MESSAGE, { delay: 5 });
  assert.equal(await phase(p), 'starting', `${tag}: typing starts Pi`);
  await shot('kaynnistyy');
  await p.waitForFunction(() => window.__wk.W.phase === 'warm');
  assert.match(await report(p, v), /hereillä/, `${tag}: Pi awake before the send`);
  await shot('hereilla');
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => !document.querySelector('.turn.live.working') && /kun ne ovat valmiita/.test(document.querySelector('.turn.live .bubble.reply')?.innerText ?? ''), null, { timeout: 60000 });
  await p.waitForTimeout(800);
  assert.equal(await phase(p), 'awake', `${tag}: awake`);
  assert.equal(await p.locator('.bubble.user', { hasText: MESSAGE }).count(), 1, `${tag}: one message, woken once`);
  const reply = await p.locator('.turn.live .bubble.reply').innerText();
  assert.match(reply, /Käynnistin kaksi workeria/, `${tag}: woken turn answers the message`);
  assert.ok(!/aikakatkaistiin/.test(reply), `${tag}: the reply does not retell the report`);
  await noOverflow(p, tag + ' awake');
  await shot('herannyt');
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
    await checkPicker(p, '2026-10-27-agentin-heratys-2');
    await p.addStyleTag({ content: `.frame{height:${width === 390 ? 1500 : 1180}px!important}` });
    const flows = theme === 'light';
    for (let v = 0; v < 3; v++) {
      const tag = `${NAMES[v]} ${size} ${theme}`;
      const shot = (s) => shoot(p, `${v + 1}-${NAMES[v]}-${size}-${theme}${s ? '-' + s : ''}.png`);
      await pick(p, v);
      await noOverflow(p, tag);
      const text = await p.locator('.frame').innerText();
      assert.ok(!/undefined|NaN|\bnull\b/.test(text), `${tag}: bad text`);
      assert.equal(await phase(p), 'stopped', `${tag}: starts resting`);
      assert.match(await p.locator('.topbar .wk-chip').textContent(), /Lepää/, `${tag}: top bar says Lepää`);
      assert.match(await report(p, v), /20\.20/, `${tag}: when it stopped, before any start`);
      assert.match(await report(p, v), /jouten/, `${tag}: why it stopped`);
      if (v === 2) {
        assert.equal(await p.locator('.wk-chipbtn').count(), 5, `${tag}: four settled and one running`);
        await p.locator('.wk-chipbtn[data-run="paging"]').click();
      }
      assert.match(await report(p, v), /sivutus\.spec\.ts:88/, `${tag}: Taskfleet's summary before any start`);
      if (v < 2) assert.match(await report(p, v), /wt\/d0x-lainaushistoria-csv/, `${tag}: preserved branch shown`);
      await noOverflow(p, tag + ' report');
      await shot(v === 2 ? 'auki' : '');
      if (flows) {
        if (v === 1) {
          await p.locator('[data-wk="settle"]').click();
          await p.locator('.wk-ev', { hasText: 'Hakuindeksin uudelleenrakennus valmistui' }).waitFor();
          assert.equal(await phase(p), 'stopped', `${tag}: a settled run does not wake`);
          await shot('valmistui');
        }
        await typeAndWake(p, v, tag, shot);
        if (v === 0) assert.match(await p.locator('.wk-card').innerText(), /Agentti lepäsi 20\.20–07\.21/, `${tag}: card stays as the record`);
        if (v === 1) assert.match(await p.locator('.wk-time').innerText(), /Viestisi herätti agentin/, `${tag}: timeline records the wake`);
        if (v === 2) {
          assert.equal(await p.locator('.wk-tray').isVisible(), false, `${tag}: tray leaves with the message`);
          assert.match(await p.locator('.bubble.user .wk-sent').innerText(), /Mukana Habitatin selostus/, `${tag}: the message carries the report`);
        }
        if (v === 0 && size === 'desktop') {
          for (const cause of ['upgrade', 'stop']) {
            await p.selectOption('#wk-cause', cause);
            await p.locator('.wk-card:not(.done)').waitFor();
            assert.match(await report(p, v), cause === 'stop' ? /Pysäytit agentin/ : /Habitat päivitettiin/, `${tag}: cause ${cause}`);
            await shot('syy-' + cause);
          }
          await p.selectOption('#wk-cause', 'idle');
          await pick(p, v);
        }
      }
      cases++;
    }
    await p.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  console.log(`PASS: ${cases} direction×size×theme cases; the host's report (stop time, cause, Taskfleet summaries, preserved branch) shows before Pi starts; typing starts Pi, the send wakes it once and the reply answers the message; a settling run updates the report without waking; stop causes; picker; no overflow, console errors or network requests.`);
} finally { await browser.close(); }
