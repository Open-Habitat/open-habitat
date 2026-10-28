// Builds the round into its issue and checks it offline: in every direction at 1440 and 390 px,
// light and dark, archiving the worktree conversation lands on the workspace page with the
// acknowledgement, opening the next conversation and typing leaves the acknowledgement clear of
// the field (production's place, shown with Nykyinen, covers it), focus never moves into it, Esc
// in the field does not close it, pointing at it pauses its clock, Palauta brings the
// conversation back and opens it, it leaves on its own after its lifetime, and the trash and
// mode notices use the same place. No console errors or network requests. Screenshots at device
// scale factor 2 into the issue's evidence directory.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-10-28-arkistoinnin-ilmoitus/verify.mjs
// A worktree without web/node_modules can point OH_WEB_PACKAGE at another checkout's web/package.json.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPicker } from '../../picker-check.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const require = createRequire(process.env.OH_WEB_PACKAGE ?? path.join(root, 'web/package.json'));
const { chromium } = require('@playwright/test');

const dir = path.join(root, 'issues/proto-archive-notice-placement/prototypes/archive-notice');
const page = path.join(dir, 'index.html');
const out = path.join(dir, 'evidence');
execFileSync('node', [path.join(root, 'design-system/prototypes/build.mjs'), here, '--out', page], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });

const NAMES = ['ylhaalla', 'kenttarivi', 'paikallaan'];
const browser = await chromium.launch();
const errors = [], requests = [];
const watch = (p) => {
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('request', r => { if (!/^(file|data|blob|about):/.test(r.url())) requests.push(r.url()); });
};
const overlap = (a, b) => a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
// The picker floats over the frame's foot; it is chrome, not part of the view.
const shot = async (p, name) => {
  await p.locator('.proto-picker').evaluate(n => { n.style.visibility = 'hidden'; });
  await p.locator('.frame').screenshot({ path: path.join(out, `${name}.png`) });
  await p.locator('.proto-picker').evaluate(n => { n.style.visibility = ''; });
};

async function open(form, theme, v, current = false) {
  const p = await browser.newPage({ viewport: { width: form === 'phone' ? 390 : 1440, height: 900 }, deviceScaleFactor: 2 });
  watch(p);
  await p.goto(`file://${page}?v=${v + 1}`);
  if (v === 0 && !current && theme === 'light') await checkPicker(p, '2026-10-28-arkistoinnin-ilmoitus');
  await p.selectOption('#theme', theme);
  if (form === 'phone') await p.check('#phone');
  if (current) await p.check('#an-current');
  await p.locator('.vwrap').waitFor();
  await p.waitForTimeout(300);
  return p;
}
// Archive from the top bar; production goes to the workspace page with the notice.
async function archive(p) {
  await p.locator('.topbar [data-ui="archive"]').click();
  await p.locator('.an-wspage h1').waitFor();
  const inNote = await p.evaluate(() => !!document.activeElement.closest('[data-note]'));
  assert.equal(inNote, false, 'focus moved into the acknowledgement');
  await p.waitForTimeout(800); // the archive is confirmed and Palauta enables
}
const note = (p) => p.locator('[data-note]').first();

for (const form of ['desk', 'phone']) for (const theme of ['light', 'dark']) {
  const tag = `${form}-${theme === 'light' ? 'vaalea' : 'tumma'}`;
  // Production's place, for comparison: it sits on the next conversation's field.
  {
    const p = await open(form, theme, 0, true);
    await archive(p);
    await p.locator('.an-ws-row[data-conv="c1"]').click();
    await p.waitForTimeout(700);
    await p.locator('.composer textarea').fill('Lisää vielä --table-lippu');
    const n = await note(p).boundingBox(); const f = await p.locator('.composer .cbox').boundingBox();
    assert.ok(overlap(n, f), `${tag}: production's notice should cover the field`);
    await shot(p, `0-nykyinen-${tag}`);
    await p.close();
  }
  for (let v = 0; v < 3; v++) {
    const name = `${v + 1}-${NAMES[v]}-${tag}`;
    const p = await open(form, theme, v);
    await archive(p);
    assert.equal(await note(p).count(), 1, `${name}: acknowledgement missing after archive`);
    if (form === 'desk' || v === 2) await shot(p, `${name}-tyotilasivu`);
    // The real moment: the next conversation opens and the person starts typing.
    await p.locator('.an-ws-row[data-conv="c1"]').click();
    await p.waitForTimeout(700); // the thread's entrance settles
    await p.locator('.composer textarea').click();
    await p.locator('.composer textarea').fill('Lisää vielä --table-lippu');
    await p.keyboard.press('Escape');
    const box = v === 2 ? null : await note(p).boundingBox();
    if (v !== 2) assert.ok(box, `${name}: acknowledgement should still be visible`);
    const field = await p.locator('.composer .cbox').boundingBox();
    const send = await p.locator('.composer .c-send').boundingBox();
    assert.ok(!overlap(box, field) && !overlap(box, send), `${name}: acknowledgement covers the field`);
    if (v === 1) {
      // In flow: the last reply ends above the acknowledgement, nothing hides under it.
      const last = await p.locator('.vwrap .bubble.reply').last().boundingBox();
      const stage = await p.locator('#stage').boundingBox();
      assert.ok(stage.y + stage.height <= box.y + 1, `${name}: thread runs under the acknowledgement`);
      assert.ok(last.y + last.height <= box.y + 1 || last.y + last.height > stage.y + stage.height, `${name}: reply under the acknowledgement`);
    }
    if (v === 2) assert.equal(await p.locator('.an-host [data-note]').count(), 0, `${name}: a floating notice appeared`);
    await shot(p, `${name}-seuraava`);
    if (form === 'phone' && v === 2) { await p.locator('.topbar [data-ui="drawer"]').click(); await p.waitForTimeout(300); await shot(p, `${name}-valikko`); await p.locator('.rail .rail-close').click(); }
    // Pointing pauses the clock.
    if (v !== 2 || form === 'desk') {
      const target = v === 2 ? p.locator('.rail [data-note]') : note(p);
      await target.hover();
      assert.ok(await target.evaluate(el => el.classList.contains('held')), `${name}: hover does not pause`);
      await p.mouse.move(2, 2);
    }
    // Other floating notices share the place.
    if (theme === 'light') {
      await p.click('#an-trash'); await p.click('#an-mode'); await p.waitForTimeout(250);
      await shot(p, `${name}-muut`);
      const f2 = await p.locator('.composer .cbox').boundingBox();
      for (const el of await p.locator('.an-host [data-note]').all()) assert.ok(!overlap(await el.boundingBox(), f2), `${name}: another notice covers the field`);
    }
    // Undo brings the conversation back and opens it.
    if (v === 2 && form === 'phone') await p.locator('.topbar [data-ui="drawer"]').click();
    const restore = v === 2 ? p.locator('.rail [data-note] [data-an="restore"]').first() : p.locator('.an-host [data-note]').filter({ hasText: 'Arkistoitu' }).locator('[data-an="restore"]');
    await restore.click();
    await p.waitForTimeout(800);
    assert.match(await p.locator('.topbar .tb-title strong').textContent(), /WebP/, `${name}: Palauta did not reopen the conversation`);
    assert.equal(await p.locator('[data-note]').filter({ hasText: 'Kuvien pakkaus' }).count(), 0, `${name}: acknowledgement stayed after Palauta`);
    await p.close();
  }
}
// Lifetime: the floating acknowledgement leaves on its own after 8 s.
{
  const p = await open('desk', 'light', 0);
  await archive(p);
  await p.mouse.move(2, 2);
  await p.waitForTimeout(8600);
  assert.equal(await p.locator('[data-note]').count(), 0, 'acknowledgement did not leave after 8 s');
  await p.close();
}
await browser.close();
assert.deepEqual(errors, [], 'console errors');
assert.deepEqual(requests, [], 'network requests');
console.log(`ok: ${out}`);
