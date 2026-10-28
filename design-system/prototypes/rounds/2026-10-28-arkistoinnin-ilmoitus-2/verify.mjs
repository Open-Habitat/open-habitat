// Builds round 2 into its issue and checks it offline: for every look at 1440 and 390 px, light
// and dark, archiving the worktree conversation lands on the workspace page with the
// acknowledgement under the top bar, focus never moves into it, opening the next conversation
// and typing leaves it clear of the field and the send button, Esc in the field does not close
// it, the newest reply is not cut off (Otsakerivi pushes the thread), the trash and mode notices
// stack the look's way (Kortti: a deck that opens under the pointer, Nauha: rows, Otsakerivi: a
// count that unfolds), a stuck removal stays, Palauta brings the conversation back, and each
// look leaves on its own after its lifetime. No console errors or network requests.
// Screenshots at device scale factor 2 into the issue's evidence directory.
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-10-28-arkistoinnin-ilmoitus-2/verify.mjs
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

const dir = path.join(root, 'issues/proto-archive-notice-placement/prototypes/archive-notice-2');
const page = path.join(dir, 'index.html');
const out = path.join(dir, 'evidence');
execFileSync('node', [path.join(root, 'design-system/prototypes/build.mjs'), here, '--out', page], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });

const LOOKS = [
  { name: 'kortti', host: '.an-card-host', life: 8000 },
  { name: 'nauha', host: '.an-band-host', life: 10000 },
  { name: 'otsakerivi', host: '.an-head-host', life: 20000 },
];
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
async function open(form, theme, v) {
  const p = await browser.newPage({ viewport: { width: form === 'phone' ? 390 : 1440, height: 900 }, deviceScaleFactor: 2 });
  watch(p);
  await p.goto(`file://${page}?v=${v + 1}`);
  if (v === 0 && form === 'desk' && theme === 'light') await checkPicker(p, '2026-10-28-arkistoinnin-ilmoitus-2');
  await p.selectOption('#theme', theme);
  if (form === 'phone') await p.check('#phone');
  await p.locator('.vwrap').waitFor();
  await p.waitForTimeout(300);
  return p;
}
async function archive(p) {
  await p.locator('.topbar [data-ui="archive"]').click();
  await p.locator('.an-wspage h1').waitFor();
  assert.equal(await p.evaluate(() => !!document.activeElement.closest('.an-host')), false, 'focus moved into the acknowledgement');
  await p.waitForTimeout(800); // the archive is confirmed and Palauta enables
}
const visible = (p, host) => p.locator(`${host} [data-note]:visible`);

for (const form of ['desk', 'phone']) for (const theme of ['light', 'dark']) for (let v = 0; v < 3; v++) {
  const L = LOOKS[v];
  const name = `${v + 1}-${L.name}-${form}-${theme === 'light' ? 'vaalea' : 'tumma'}`;
  const p = await open(form, theme, v);
  await archive(p);
  const note = visible(p, L.host).first();
  assert.equal(await visible(p, L.host).count(), 1, `${name}: acknowledgement missing after archive`);
  const top = await p.locator('.topbar').boundingBox();
  const nb = await note.boundingBox();
  assert.ok(nb.y >= top.y + top.height - 1, `${name}: acknowledgement covers the top bar`);
  await p.mouse.move(2, 2);
  await shot(p, `${name}-tyotilasivu`);
  // The real moment: the next conversation opens and the person starts typing.
  await p.locator('.an-ws-row[data-conv="c1"]').click();
  await p.waitForTimeout(700);
  await p.locator('.composer textarea').click();
  await p.locator('.composer textarea').fill('Lisää vielä --table-lippu');
  await p.keyboard.press('Escape');
  assert.equal(await visible(p, L.host).count(), 1, `${name}: Esc in the field closed the acknowledgement`);
  const box = await note.boundingBox();
  const field = await p.locator('.composer .cbox').boundingBox();
  const send = await p.locator('.composer .c-send').boundingBox();
  assert.ok(!overlap(box, field) && !overlap(box, send), `${name}: acknowledgement covers the field`);
  // The newest reply is not cut off or covered.
  const reply = await p.locator('.vwrap .bubble.reply').last().boundingBox();
  const st = await p.locator('#stage').boundingBox();
  assert.ok(reply.y + reply.height <= st.y + st.height + 1, `${name}: the newest reply is cut off`);
  assert.ok(!overlap(box, reply), `${name}: acknowledgement covers the newest reply`);
  assert.equal(await p.evaluate(() => document.activeElement.tagName), 'TEXTAREA', `${name}: focus left the field`);
  await shot(p, `${name}-seuraava`);

  // Other floating notices stack the look's way.
  await p.click('#an-trash'); await p.click('#an-mode'); await p.waitForTimeout(300);
  const all = p.locator(`${L.host} [data-note]`);
  assert.equal(await all.count(), 3, `${name}: three notices expected`);
  if (v === 0) {
    assert.equal(await p.locator('.an-card[data-depth="0"] .an-more').textContent(), '+2', `${name}: deck count`);
    assert.ok(await p.locator('.an-card[data-depth="2"]').evaluate(el => el.classList.contains('held')), `${name}: a waiting card's clock runs`);
  }
  if (v === 2) {
    assert.equal(await visible(p, L.host).count(), 1, `${name}: folded lines visible`);
    assert.equal(await p.locator('.an-count').textContent(), '+2', `${name}: line count`);
  }
  if (v === 1) assert.equal(await visible(p, L.host).count(), 3, `${name}: band rows`);
  const f2 = await p.locator('.composer .cbox').boundingBox();
  for (const el of await visible(p, L.host).all()) assert.ok(!overlap(await el.boundingBox(), f2), `${name}: a stacked notice covers the field`);
  await p.mouse.move(2, 2);
  await shot(p, `${name}-pino`);
  // Open the stack: Kortti under the pointer, Otsakerivi from its count.
  if (v === 0) { await p.locator(`${L.host} [data-depth="0"]`).hover(); await p.waitForTimeout(350); assert.equal(await visible(p, L.host).count(), 3); }
  if (v === 2) { await p.locator('.an-count').click(); await p.waitForTimeout(250); assert.equal(await visible(p, L.host).count(), 3); }
  if (v !== 1) await shot(p, `${name}-pino-auki`);
  for (const el of await visible(p, L.host).all()) assert.ok(!overlap(await el.boundingBox(), f2), `${name}: an opened notice covers the field`);

  // Undo brings the conversation back and opens it.
  if (v === 0) await p.locator(L.host).hover();
  await p.locator(`${L.host} [data-note]`).filter({ hasText: 'Arkistoitu' }).locator('[data-an="restore"]').click();
  await p.waitForTimeout(800);
  assert.match(await p.locator('.topbar .tb-title strong').textContent(), /WebP/, `${name}: Palauta did not reopen the conversation`);
  assert.equal(await p.locator('[data-note]').filter({ hasText: 'Kuvien pakkaus' }).count(), 0, `${name}: acknowledgement stayed after Palauta`);

  await p.close();
}
// A removal that went wrong stays until closed, in every look.
for (let v = 0; v < 3; v++) for (const [form, theme] of [['desk', 'light'], ['phone', 'dark']]) {
  const L = LOOKS[v];
  const name = `${v + 1}-${L.name}-${form}-${theme === 'light' ? 'vaalea' : 'tumma'}`;
  const p = await open(form, theme, v);
  await p.click('#an-stuck'); await p.waitForTimeout(300); await p.mouse.move(2, 2);
  assert.ok(await p.locator(`${L.host} .an-bad`).evaluate(el => el.classList.contains('held')), `${name}: a stuck removal's clock runs`);
  await shot(p, `${name}-kesken`);
  await p.close();
}
// Lifetime: each look leaves on its own after its lifetime, not before.
for (let v = 0; v < 3; v++) {
  const L = LOOKS[v];
  const p = await open('desk', 'light', v);
  await archive(p);
  await p.mouse.move(2, 2);
  await p.waitForTimeout(L.life - 2000);
  assert.equal(await p.locator('[data-note]').count(), 1, `${L.name}: left before ${L.life} ms`);
  await p.waitForTimeout(2800);
  assert.equal(await p.locator('[data-note]').count(), 0, `${L.name}: did not leave after ${L.life} ms`);
  await p.close();
}
await browser.close();
assert.deepEqual(errors, [], 'console errors');
assert.deepEqual(requests, [], 'network requests');
console.log(`ok: ${out}`);
